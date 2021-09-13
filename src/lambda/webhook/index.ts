import * as Lambda from 'aws-lambda'
import * as Line from "@line/bot-sdk"
import * as Types from "@line/bot-sdk/lib/types"
import * as AWS from "aws-sdk"

// 実行環境取得
const env: any = process.env.env

// DynamoDB のテーブル名取得
const tableName: any = process.env.tableName
let documentClient: any

// Line UserId 取得
const userId: any = process.env.userId

// Lambda の実行 handler
export const handler: Lambda.Handler = async (event: any) => {
  console.log('処理開始')
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

// Line message 送信
const sendMessage: any = async (lineMessage: Types.Message) => {
  switch (env) {
    // local だったら console にメッセージを出力
    case 'local': {
      console.log(JSON.stringify(lineMessage))
      break
    }
    // local じゃなかったらメッセージ送信
    default:
      // Line token
      const accessToken: string = process.env.accessToken!
      const channelSecret: string = process.env.channelSecret!

      const config: Line.ClientConfig = {
        channelAccessToken: accessToken,
        channelSecret: channelSecret,
      }
      const client = new Line.Client(config)

      try {
        const result = await client.pushMessage(userId, lineMessage)
        console.log('メッセージ送信成功')
        return result
      }
      catch (e) {
        console.error('メッセージ送信失敗', JSON.stringify(e))
      }
  }
}
