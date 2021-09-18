import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as logs from '@aws-cdk/aws-logs';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as events from '@aws-cdk/aws-events';
import * as targets from '@aws-cdk/aws-events-targets';
import * as ssm from '@aws-cdk/aws-ssm';
import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2';
import * as apigatewayv2Integration from '@aws-cdk/aws-apigatewayv2-integrations';
import * as certificatemanager from '@aws-cdk/aws-certificatemanager';
import * as route53 from "@aws-cdk/aws-route53";

export class TakeMedicineNotificationStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const accessToken: string = ssm.StringParameter.valueFromLookup(this, 'medicine_line_access_token')
    const channelSecret: string = ssm.StringParameter.valueFromLookup(this, 'medicine_line_channel_secret')
    const userId: string = ssm.StringParameter.valueFromLookup(this, 'medicine_line_user_id')

    const dynamodbTable = new dynamodb.Table(this, 'dynamodbTable', {
      partitionKey: {
        name: 'UserId', type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'TimetableId', type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });
    dynamodbTable.addLocalSecondaryIndex({
      indexName: "HourLSI",
      sortKey: {
        name: "Hour",
        type: dynamodb.AttributeType.NUMBER
      }
    });

    const cronFunction = new lambda.DockerImageFunction(this, 'cronFunction', {
      code: lambda.DockerImageCode.fromImageAsset("src/lambda/cron"),
      memorySize: 128,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        accessToken: accessToken,
        channelSecret: channelSecret,
        userId: userId,
        tableName: dynamodbTable.tableName.toString(),
      },
      deadLetterQueueEnabled: true,
    });

    dynamodbTable.grantReadWriteData(cronFunction);

    new events.Rule(this, "scheduleEvent", {
      schedule: events.Schedule.cron({
        minute: "0",
        hour: "1-14",
        day: "*",
        month: "*",
        year: "*"
      }),
      targets: [new targets.LambdaFunction(cronFunction)]
    });

    // Webhook
    const domain:string = ssm.StringParameter.valueFromLookup(this, 'domain')

    const hostedZone = route53.HostedZone.fromLookup(this, "hostedZone", {
      domainName: domain
    });

    const lineBotAcm = new certificatemanager.Certificate(this, 'lineBotAcm', {
      domainName: 'takemedicine.linebot.' + domain,
      validation: certificatemanager.CertificateValidation.fromDns(hostedZone),
    });

    const webhookFunction = new lambda.DockerImageFunction(this, 'webhookFunction', {
      code: lambda.DockerImageCode.fromImageAsset("src/lambda/webhook"),
      memorySize: 128,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        accessToken: accessToken,
        channelSecret: channelSecret,
        userId: userId,
        tableName: dynamodbTable.tableName.toString(),
      },
      deadLetterQueueEnabled: true,
    });

    dynamodbTable.grantReadWriteData(webhookFunction);

    const lineBotHttpApiDomain = new apigatewayv2.DomainName(this, 'lineBotHttpApiDomain', {
      domainName: "takemedicine.linebot." + domain,
      certificate: lineBotAcm
    })

    const lineBotHttpApi = new apigatewayv2.HttpApi(this, 'lineBotHttpApi', {
      apiName: 'LineBotHttpApi',
      defaultDomainMapping: {
        domainName: lineBotHttpApiDomain
      }
    });

    lineBotHttpApi.addRoutes({
      path: '/',
      methods: [ apigatewayv2.HttpMethod.POST ],
      integration: new apigatewayv2Integration.LambdaProxyIntegration({
        handler: webhookFunction
      })
    })

    new route53.CnameRecord(this, 'cnameRecord', {
      zone: hostedZone,
      domainName: lineBotHttpApiDomain.regionalDomainName,
      recordName: 'takemedicine.linebot',
    })
  }
}
