#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

import { ApiStack } from '../lib/api-stack.js';

/**
 * WildWindow AWS CDK app (Milestone H / T9.2).
 *
 * Default region: eu-west-2 (ARCHITECTURE §11). Deploy is blocked until Arsalan
 * provides the AWS account and approves `cdk deploy`. `cdk synth` needs no account.
 *
 * Railway remains the interim staging host (docs/RAILWAY.md).
 */
const app = new cdk.App();

const stageName = (app.node.tryGetContext('stage') as string | undefined)?.trim() || 'staging';

const account = process.env['CDK_DEFAULT_ACCOUNT'];
const region = process.env['CDK_DEFAULT_REGION'] ?? 'eu-west-2';

const env =
  account !== undefined && account.length > 0
    ? { account, region }
    : // Environment-agnostic: synth + snapshot tests without AWS credentials.
      { region };

new ApiStack(app, `WildWindow-Api-${stageName}`, {
  stageName,
  env,
  description: `WildWindow API network/database/ECS (${stageName}) — T9.2`,
  tags: {
    Project: 'WildWindow',
    Stage: stageName,
    ManagedBy: 'cdk',
    Task: 'T9.2',
  },
});

app.synth();
