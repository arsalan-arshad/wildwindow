import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';

import { ApiStack } from '../lib/api-stack.js';

function synthTemplate(stageName = 'staging'): Template {
  const app = new cdk.App();
  const stack = new ApiStack(app, 'TestApiStack', {
    stageName,
    env: { region: 'eu-west-2' },
  });
  return Template.fromStack(stack);
}

describe('ApiStack (T9.2)', () => {
  it('matches CloudFormation snapshot', () => {
    const template = synthTemplate();
    expect(template.toJSON()).toMatchSnapshot();
  });

  it('creates a VPC with public, private, and isolated subnets', () => {
    const template = synthTemplate();
    template.resourceCountIs('AWS::EC2::VPC', 1);
    template.hasResourceProperties('AWS::EC2::Subnet', {
      MapPublicIpOnLaunch: true,
    });
    // Isolated DB subnets have no MapPublicIpOnLaunch and sit off private routes.
    template.resourceCountIs('AWS::EC2::Subnet', 6); // 2 AZ × 3 tiers
    template.resourceCountIs('AWS::EC2::NatGateway', 1);
  });

  it('creates RDS PostgreSQL (PostGIS via migration) in isolated subnets', () => {
    const template = synthTemplate();
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      Engine: 'postgres',
      EngineVersion: Match.stringLikeRegexp('^16'),
      DBInstanceClass: 'db.t4g.micro',
      MultiAZ: false,
      PubliclyAccessible: false,
      StorageEncrypted: true,
      DBName: 'wildwindow',
    });
  });

  it('creates an ECR repository for the API image', () => {
    const template = synthTemplate();
    template.hasResourceProperties('AWS::ECR::Repository', {
      RepositoryName: 'ww-staging-api',
      ImageScanningConfiguration: { ScanOnPush: true },
    });
  });

  it('creates ECS Fargate API behind an ALB', () => {
    const template = synthTemplate();
    template.resourceCountIs('AWS::ECS::Cluster', 1);
    template.hasResourceProperties('AWS::ECS::Service', {
      LaunchType: 'FARGATE',
      DesiredCount: 1,
    });
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      RequiresCompatibilities: ['FARGATE'],
      Cpu: '256',
      Memory: '512',
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: 'api',
          PortMappings: Match.arrayWith([
            Match.objectLike({ ContainerPort: 3001, Protocol: 'tcp' }),
          ]),
        }),
      ]),
    });
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 80,
      Protocol: 'HTTP',
    });
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      Port: 3001,
      Protocol: 'HTTP',
      HealthCheckPath: '/v1/health',
    });
  });

  it('creates Secrets Manager entries with no secret values', () => {
    const template = synthTemplate();
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'ww-staging/api/app',
    });
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'ww-staging/db/app-roles',
    });
    // Empty shells: no SecretString / GenerateSecretString on the app shells.
    const secrets = template.findResources('AWS::SecretsManager::Secret');
    const appShell = Object.values(secrets).find(
      (r) => (r['Properties'] as { Name?: string } | undefined)?.Name === 'ww-staging/api/app',
    );
    expect(appShell).toBeDefined();
    const props = appShell?.['Properties'] as Record<string, unknown>;
    expect(props['SecretString']).toBeUndefined();
    expect(props['GenerateSecretString']).toBeUndefined();
  });
});
