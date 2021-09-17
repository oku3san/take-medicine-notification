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
  // EventBridge の発火時間を取得
  const date: Date = new Date(event.time)
  const jstDate: Date = convertUtcToJst(date.getTime())
  const hour: number = Number(jstDate.getHours().toString().padStart(2, '0'))

  // 特定の時間に status を 0 に変更する
  if (hour === 0) {
    Promise.all([
      await changeAllStatus()
    ]).then(() => {
      console.log("ステータス初期化実施")
      console.log("処理成功")
    }).catch(() => {
      console.error("ステータス初期化失敗")
      console.log("処理失敗")
    })
  } else {
    // 発火時間をもとに DynamoDB より値取得
    const data: any = await fetchData(hour)

    if (data.Count === 0) {  // 検索結果が0件なら
      const lineMessage: Types.Message = {type: "text", text: '0件'}
      console.log(lineMessage)
      console.log('処理成功')
    } else { // 検索結果が0件ではなかったら
       if (data.Items[0].Status === 1) {  // ステータスが1なら終了
         console.log('実施済みのため処理終了')
         console.log("処理成功")
         return
       } else {  // ステータスが0なら処理継続
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
  console.log('データ取得開始')
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
    const result = await documentClient.query(params).promise()
    console.log('データ取得成功')
    return result
  } catch (e) {
    console.error('データ取得失敗', JSON.stringify(e))
  }
}

// Status を変更する
const changeStatus = async (status: number, timetableId: number, hour?: number) => {
  console.log('changeStatus データ更新開始')
  setDynamodbOptions()
  let params: any
  if (hour) {
    // 特定時間のステータスを更新する
    params = {
      TableName: tableName,
      Key: {
        'UserId': userId,
        'TimetableId': timetableId
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
    // 特定タイムテーブルのステータスを更新する
    params = {
      TableName: tableName,
      Key: {
        'UserId': userId,
        'TimetableId': timetableId
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
    const result = documentClient.update(params).promise()
    console.log('changeStatus データ更新成功')
    return result
  }
  catch(e) {
    console.error('changeStatus データ更新失敗', JSON.stringify(e))
  }
}

// Status を全て初期化する
const changeAllStatus = async () => {
  console.log("ステータス初期化開始")
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
    // ユーザ ID の全部の sort キーを取得するして status を更新する
    const data: any = await documentClient.scan(params).promise()
    for(let element of data.Items) {
      await changeStatus(0, element.TimetableId)
    }
    return
  }
  catch(e) {
    console.error("changeAllStatus データ更新失敗", JSON.stringify(e))
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

const convertUtcToJst = (utcDate: number) => {
  const jstDate: Date = new Date(utcDate + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000))
  return jstDate
}
