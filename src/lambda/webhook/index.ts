import * as Lambda from 'aws-lambda'
import * as Line from "@line/bot-sdk"
import * as Types from "@line/bot-sdk/lib/types"
import * as AWS from "aws-sdk"

// 実行環境取得
const env: any = process.env.env

// DynamoDB のテーブル名取得
const tableName: any = process.env.tableName
let documentClient: any

// userId 取得
const userId: any = process.env.userId

// Lambda の実行 handler
export const handler: Lambda.Handler = async (proxyEvent: any) => {
  console.log('処理開始')

  const body: Line.WebhookRequestBody = JSON.parse(JSON.stringify(proxyEvent!));
  await Promise
    .all(body.events.map(async event => eventHandler(event)))
    .catch((e) => {
      console.error(JSON.stringify(e))
      return {
        statusCode: 500,
        body: "Error"
      }
    })
  console.log('処理終了')
  return {
    statusCode: 200,
    body: "OK"
  }
}

// メッセージの内容をもとに処理を切り替え
const eventHandler = async (event: Line.WebhookEvent): Promise<any> => {

  if (event.type !== 'message' || event.message.type !== 'text') {
    return null
  }

  // メッセージの内容をもとに処理を切り替え
  switch (event.message.text) {
    case '一覧表示': {
      // DynamoDB から情報取得
      const messages = await fetchAllData()
        .then((data: any) => {  // 取得したデータをもとに処理
          // Hour 順にソート
          let items: string[] = data.Items
          items.sort((a: any, b: any) => {
            if (a.Hour < b.Hour) {
              return -1;
            } else {
              return 1;
            }
          })

          // メッセージを配列に追加
          let messages: string[] = []
          items.forEach((item: any) => {
            if (item.Hour === 0) {
              messages.push(`${item.Timetable}は未設定`)
            } else {
              messages.push(`${item.Timetable}は${item.Hour}時`)
            }
          })

          return messages
        })

      // Line message 送信
      const lineMessage: Types.Message = {type: "text", text: messages.join('\n')}
      return await sendMessage(event.replyToken, lineMessage)
      break
    }
    default: {
      const lineMessage: Types.Message = {type: "sticker", packageId: '8515', stickerId: '16581263'};
      return await sendMessage(event.replyToken, lineMessage)
    }
  }
}

// Line message 送信
// replyToken と lineMessage を引数にする
const sendMessage = async (replyToken: string, lineMessage: Types.Message): Promise<any> => {

  // Line message を送信する初期設定
  const accessToken: string = process.env.accessToken!
  const channelSecret: string = process.env.channelSecret!
  const config: Line.ClientConfig = {
    channelAccessToken: accessToken,
    channelSecret: channelSecret,
  }
  const client: Line.Client = new Line.Client(config)

  try {
    return await client.replyMessage(replyToken, lineMessage)
  }
  catch(e) {
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
const fetchAllData = async (): Promise<any> => {
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
