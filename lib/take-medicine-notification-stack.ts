import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';

export class TakeMedicineNotificationStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const cronFunction = new lambda.DockerImageFunction(this, 'cronFunction', {
      code: lambda.DockerImageCode.fromImageAsset("src/lambda/cron"),
      memorySize: 128,
      environment: {
      },
    });
  }
}
