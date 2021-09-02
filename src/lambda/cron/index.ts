import * as Lambda from 'aws-lambda';
import * as Line from "@line/bot-sdk";
import * as Types from "@line/bot-sdk/lib/types";
import * as AWS from "aws-sdk";

console.log('Loading function');

export const handler: Lambda.Handler = async (event, context: Lambda.Context) => {
  console.log('Received event:', JSON.stringify(event));
  console.log('value1 =', event.key1);
  console.log('value2 =', event.key2);
  console.log('value3 =', event.key3);
  return event.key1;  // Echo back the first key value
  throw new Error('Something went wrong');
};
