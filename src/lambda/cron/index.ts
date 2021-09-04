import * as Lambda from 'aws-lambda';
import * as Line from "@line/bot-sdk";
import * as Types from "@line/bot-sdk/lib/types";
import * as AWS from "aws-sdk";

export const handler: Lambda.Handler = async (event, context: Lambda.Context) => {
  const documentClient = new AWS.DynamoDB.DocumentClient();
  const dynamo = new AWS.DynamoDB({
    endpoint: 'http://dynamodb:8000',
    region: "hoge",
    accessKeyId: 'fuga',
    secretAccessKey: 'piyo'
  });

  const createTableInput = {
    AttributeDefinitions: [
      {
        AttributeName: "Id",
        AttributeType: "S",
      },
    ],
    KeySchema: [
      {
        AttributeName: "Id",
        KeyType: "HASH",
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    },
    TableName: "Test",
  };

  try {
    // テーブルを作成
    const response = await dynamo.createTable(createTableInput).promise();
    console.log(response);
  } catch (e) {
    console.error("テーブル作成失敗", e);
  }
};
