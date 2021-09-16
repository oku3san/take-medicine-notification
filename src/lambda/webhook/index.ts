import * as Lambda from 'aws-lambda'
import * as Line from "@line/bot-sdk"
import * as Types from "@line/bot-sdk/lib/types"
import * as AWS from "aws-sdk"

// 実行環境取得
const env: any = process.env.env

// DynamoDB のテーブル名取得
const tableName: any = process.env.tableName
let documentClient: any

// Line 関連
const userId: any = process.env.userId
const accessToken: string = process.env.accessToken!
const channelSecret: string = process.env.channelSecret!

// Lambda の実行 handler
export const handler: Lambda.Handler = async (proxyEvent: any) => {
  console.log('処理開始')

  const body: Line.WebhookRequestBody = JSON.parse(JSON.stringify(proxyEvent!));
  await Promise
    .all(body.events.map(async event => sendMessage(event)))
    .catch(err => {
      console.error(err.Message);
      return {
        statusCode: 500,
        body: "Error"
      }
    })
  return {
    statusCode: 200,
    body: "OK"
  }
}

// Line message 送信
const sendMessage: any = async (event: Line.WebhookEvent): Promise<any> => {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null
  }

  const config: Line.ClientConfig = {
    channelAccessToken: accessToken,
    channelSecret: channelSecret,
  }
  const client: Line.Client = new Line.Client(config)

  try {
    const data: Promise<any> = await fetchAllData()
      .then((data: any) => {
        let messages: string[] = []
        let items: string[] = data.Items

        // Hour 順にソート
        items.sort((a: any, b: any) => {
          if (a.Hour < b.Hour) {
            return -1;
          } else {
            return 1;
          }
        })

        // メッセージを配列に追加
        items.forEach((item: any) => {
          if (item.Hour === 0) {
            messages.push(`${item.Timetable}は未設定`)
          } else {
            messages.push(`${item.Timetable}は${item.Hour}時`)
          }
        })

        const lineMessage: Types.Message = {type: "text", text: messages.join('\n')}
        return client.replyMessage(event.replyToken, lineMessage)
      })
  }
  catch (e) {
    console.error("メッセージ送信失敗", JSON.stringify(e))
  }
}

// DynamoDB の初期設定
const setDynamodbOptions = (): void => {
  switch (env) {
    case 'local': {
      // DynamoDB のエンドポイント取得
      const dynamoDbEndpoint: any = process.env.dynamoDbEndpoint
      documentClient = new AWS.DynamoDB.DocumentClient({
        endpoint: `http://${dynamoDbEndpoint}:8000`,
        region: "hoge",
        accessKeyId: 'fuga',
        secretAccessKey: 'piyo'
      })
      break
    }
    default:
      documentClient = new AWS.DynamoDB.DocumentClient()
  }
}

// DynamoDB から一覧データ取得
const fetchAllData: any = async (): Promise<any> => {
  console.log('データ取得開始')
  setDynamodbOptions()

  // scan してユーザ ID でフィルタ
  const params = {
    TableName: tableName,
    FilterExpression: "UserId = :UserId",
    ExpressionAttributeValues: {
      ':UserId': userId,
    }
  }
  try {
    // ユーザ ID の全部のレコードを取得
    return await documentClient.scan(params).promise()
  }
  catch(e) {
    console.error("データ取得失敗", JSON.stringify(e))
  }
}
