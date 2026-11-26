import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

import type { Construct } from 'constructs';

export interface ApiStackProps extends cdk.StackProps {
  /** Logical stage name used in resource names (default: staging). */
  stageName?: string;
}

/**
 * Milestone H (T9.2): network, database and API.
 *
 * - VPC (public + private-with-egress + isolated)
 * - RDS PostgreSQL (PostGIS enabled by app migration, not here)
 * - ECR repository for the API image
 * - ECS Fargate service behind an internet-facing ALB
 * - Secrets Manager shells (no secret values in CDK)
 *
 * Railway remains the interim staging host until Arsalan approves `cdk deploy`.
 * Do not run deploy from agents.
 */
export class ApiStack extends cdk.Stack {
  readonly vpc: ec2.Vpc;
  readonly apiRepository: ecr.Repository;
  readonly database: rds.DatabaseInstance;
  readonly cluster: ecs.Cluster;
  readonly loadBalancer: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: ApiStackProps = {}) {
    super(scope, id, props);

    const stageName = props.stageName ?? 'staging';
    const prefix = `ww-${stageName}`;

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${prefix}-vpc`,
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Empty shells — populate in the console / CLI after deploy. Never put values in CDK.
    const appSecret = new secretsmanager.CfnSecret(this, 'ApiAppSecret', {
      name: `${prefix}/api/app`,
      description:
        'WildWindow API app secrets (FIREBASE_SERVICE_ACCOUNT_JSON, LOGBOOK_ENC_KEY, ADMIN_TOKEN, OBSERVER_HASH_SALT, SENTRY_DSN, POSTHOG_KEY, …). CDK creates the entry with no values.',
    });
    appSecret.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    const dbAppRolesSecret = new secretsmanager.CfnSecret(this, 'DbAppRolesSecret', {
      name: `${prefix}/db/app-roles`,
      description:
        'ww_api / ww_worker role passwords and composed DATABASE_URL_API / DATABASE_URL_WORKER. CDK creates the entry with no values; set after migrate roles.',
    });
    dbAppRolesSecret.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    this.apiRepository = new ecr.Repository(this, 'ApiRepository', {
      repositoryName: `${prefix}-api`,
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      emptyOnDelete: false,
      lifecycleRules: [
        {
          description: 'Keep last 20 images',
          maxImageCount: 20,
          rulePriority: 1,
        },
      ],
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'RDS PostgreSQL (PostGIS via migration)',
      allowAllOutbound: false,
    });

    const apiSecurityGroup = new ec2.SecurityGroup(this, 'ApiSecurityGroup', {
      vpc: this.vpc,
      description: 'ECS Fargate API tasks',
      allowAllOutbound: true,
    });

    const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: this.vpc,
      description: 'Internet-facing ALB',
      allowAllOutbound: true,
    });
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'HTTP (TLS/ACM to be added when Arsalan attaches a certificate)',
    );

    dbSecurityGroup.addIngressRule(
      apiSecurityGroup,
      ec2.Port.tcp(5432),
      'Postgres from API tasks only',
    );

    // Engine: managed Postgres. PostGIS is CREATE EXTENSION in packages/db migrations (T0.x / T2.x).
    this.database = new rds.DatabaseInstance(this, 'Database', {
      instanceIdentifier: `${prefix}-postgres`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      // Smallest practical size, single-AZ — ARCHITECTURE §13 beta cost notes.
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      databaseName: 'wildwindow',
      credentials: rds.Credentials.fromGeneratedSecret('ww_owner', {
        secretName: `${prefix}/db/owner`,
      }),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      multiAz: false,
      publiclyAccessible: false,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      backupRetention: cdk.Duration.days(7),
      cloudwatchLogsExports: ['postgresql'],
      parameterGroup: new rds.ParameterGroup(this, 'DatabaseParams', {
        engine: rds.DatabaseInstanceEngine.postgres({
          version: rds.PostgresEngineVersion.VER_16,
        }),
        description: 'WildWindow RDS parameters (PostGIS enabled by migration)',
      }),
    });

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: `${prefix}-cluster`,
      vpc: this.vpc,
      containerInsightsV2: ecs.ContainerInsights.DISABLED,
    });

    const logGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/wildwindow/${stageName}/api`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'ApiTaskDefinition', {
      family: `${prefix}-api`,
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    const container = taskDefinition.addContainer('api', {
      image: ecs.ContainerImage.fromEcrRepository(this.apiRepository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'api',
        logGroup,
      }),
      environment: {
        NODE_ENV: 'production',
        PORT: '3001',
        WEATHER_PROVIDER: 'metno',
        STORAGE_DRIVER: 's3',
        S3_REGION: cdk.Stack.of(this).region,
        WATCHLIST_LIMIT_FREE: '10',
        POSTHOG_HOST: 'https://eu.i.posthog.com',
      },
      // Secrets Manager shells above are populated after deploy (T9.4 / Arsalan).
      // DATABASE_URL_API must use ww_api — never the RDS owner secret on the API task.
      healthCheck: {
        command: [
          'CMD-SHELL',
          'node -e "fetch(\'http://127.0.0.1:3001/v1/health\').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"',
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });
    container.addPortMappings({ containerPort: 3001, protocol: ecs.Protocol.TCP });

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: this.vpc,
      internetFacing: true,
      loadBalancerName: `${prefix}-api`,
      securityGroup: albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const listener = this.loadBalancer.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: false,
    });

    const service = new ecs.FargateService(this, 'ApiService', {
      serviceName: `${prefix}-api`,
      cluster: this.cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: false,
      securityGroups: [apiSecurityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { rollback: true },
      // Image may not exist until the first CD push (T9.4); keep the service from failing the stack.
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
    });

    listener.addTargets('ApiTargets', {
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: {
        path: '/v1/health',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID (shared with T9.3 worker/storage stack)',
    });
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: 'API ALB DNS name (set API_PUBLIC_URL after TLS)',
    });
    new cdk.CfnOutput(this, 'ApiRepositoryUri', {
      value: this.apiRepository.repositoryUri,
      description: 'ECR repository URI for the API image',
    });
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.instanceEndpoint.hostname,
      description: 'RDS hostname (private); use with Secrets Manager for connection strings',
    });
    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.database.secret?.secretArn ?? 'unset',
      description: 'RDS owner credentials secret (migrations only — never wire to the API task)',
    });
    new cdk.CfnOutput(this, 'ApiAppSecretArn', {
      value: appSecret.ref,
      description: 'Empty API app secret shell — populate after deploy',
    });
    new cdk.CfnOutput(this, 'DbAppRolesSecretArn', {
      value: dbAppRolesSecret.ref,
      description: 'Empty DB app-roles secret shell — populate after migrate roles',
    });
    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS cluster name',
    });
  }
}
