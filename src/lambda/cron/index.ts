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
  // EventBridge の発火時間を取得
  const date: Date = new Date(event.time)
  const hour: number = Number(date.getHours().toString().padStart(2, '0'))

  // 特定の時間に status を 0 に変更する
  if (hour === 0) {
      Promise.all([
        await changeAllStatus()
      ]).then(() => {
        console.log("ステータス初期化実施")
      }).catch(() => {
        console.error("ステータス初期化失敗")
      })
  } else {
    // 発火時間をもとに DynamoDB より値取得
    const data: any = await fetchData(hour)

    if (data.Count === 0) { // 検索結果が0件なら
      const lineMessage: Types.Message = {type: "text", text: '0件'}
      console.log(lineMessage)
      console.log('処理成功')
    } else { // 検索結果が0件ではなかったら
      const timetable: string = data.Items[0].Timetable
      const lineMessage: Types.Message = {
        "type": "template",
        "altText": "確認",
        "template": {
          "type": "confirm",
          "text": `${timetable}の薬は飲みましたか`,
          "actions": [
            {
              "type": "message",
              "label": "はい",
              "text": "はい"
            },
            {
              "type": "message",
              "label": "いいえ",
              "text": "いいえ"
            }
          ]
        }
      }
      Promise.all([
        await sendMessage(lineMessage)
      ]).then(() => {
        console.log('処理成功')
        return
      }).catch(() => {
        console.log('処理失敗')
        return
      })
    }
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

// DynamoDB からデータ取得
const fetchData: any = async (hour: number) => {
  setDynamodbOptions()
  const params = {
    TableName: tableName,
    IndexName: 'HourLSI',
    KeyConditionExpression: 'UserId = :UserId and #Hr = :Hr',
    ExpressionAttributeNames: {
      '#Hr': 'Hour'
    },
    ExpressionAttributeValues: {
      ':Hr': hour,
      ':UserId': userId
    }
  }

  try {
    const result  = await documentClient.query(params).promise()
    console.log('データ取得成功')
    return result
  } catch (e) {
    console.error('データ取得失敗', JSON.stringify(e))
    return
  }
}

// Status を変更する
const changeStatus = async (status: number, timetable:string, hour?: number) => {
  setDynamodbOptions()
  let params: any
  if (hour) {
    params = {
      TableName: tableName,
      Key: {
        'UserId': userId,
        'Timetable': timetable
      },
      UpdateExpression: 'SET #S = :S ',
      ConditionExpression: '#Hr = :Hr',
      ExpressionAttributeNames: {
        '#S': 'Status',
        '#Hr': 'Hour'
      },
      ExpressionAttributeValues: {
        ':S': status,
        ':Hr': hour,
      }
    }
  } else {
    params = {
      TableName: tableName,
      Key: {
        'UserId': userId,
        'Timetable': timetable
      },
      UpdateExpression: 'SET #S = :S ',
      ExpressionAttributeNames: {
        '#S': 'Status',
      },
      ExpressionAttributeValues: {
        ':S': status,
      }
    }
  }

  try {
    await documentClient.update(params).promise()
    console.log('changeStatus データ更新成功')
    return
  }
  catch(e) {
    console.error('changeStatus データ更新失敗', JSON.stringify(e))
    return
  }
}

// Status を全て初期化する
const changeAllStatus = async () => {
  setDynamodbOptions()
  const params = {
    TableName: tableName,
    FilterExpression: "UserId = :UserId",
    ExpressionAttributeValues: {
      ':UserId': userId,
    }
  }
  try {
    const data: any = await documentClient.scan(params).promise()
    data.Items.forEach((element: any) => {
      changeStatus(0, element.Timetable)
    })
    console.log('changeAllStatus データ更新成功')
    return
  }
  catch(e) {
    console.error("changeAllStatus データ更新失敗", JSON.stringify(e))
    return
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
        await client.pushMessage(userId, lineMessage)
        console.log('メッセージ送信成功')
        return
      }
      catch (e) {
        console.error('メッセージ送信失敗', JSON.stringify(e))
        return
      }
  }
}
