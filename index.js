const fs = require('fs')
const csv = require('fast-csv')
const qrcode = require('qrcode-terminal')
const { Client } = require('whatsapp-web.js')
const { time } = require('console')

const fileName = process.argv[2]

let firstRow = true
let sendedMessagesCounter = 0

const timer = (min, max) => {
  const getRandom = (min, max) => {
    return Math.random() * (max - min) + min
  }

  const time = getRandom(min, max)
  console.log(`Esperando ${time.toFixed(2)} segundos`)
  return new Promise(resolve => {
    setTimeout(resolve, time * 1000)
  })
}

const client = new Client()

client.on('qr', qr => {
  qrcode.generate(qr, { small: true })
})

client.on('ready', async () => {
  console.log('Cliente está pronto!')
  const sendMessage = async (phoneNumber, messageText) => {
    const response = await client.sendMessage(
      `${phoneNumber}@c.us`,
      messageText
    )
    return response
  }
  fileReader(sendMessage)
})

client.initialize()

const fileReader = async sendMessage => {
  const input = fs.createReadStream(`./${fileName}.csv`, { encoding: 'utf8' })
  const output = fs.createWriteStream(`./${fileName}Result.csv`, {
    encoding: 'utf8'
  })

  const transformStream = csv
    .parse({ headers: true, delimiter: ';', encoding: 'utf8' })
    .transform(async (row, callback) => {
      try {
        if (firstRow) {
          let header = Object.keys(row).concat(['Envio'])
          header = header.join(';') + '\n'
          output.write(header)
          firstRow = false
        }

        const phoneNumber = row.telefone || row.celular
        if (!phoneNumber) {
          throw new Error('Coluna telefone não encontrada')
        }

        const message = row.mensagem
        // const message = 'alguma coisa'

        await timer(1, 5)
        await sendMessage(phoneNumber, message)
        ++sendedMessagesCounter
        
        console.log(`Mensagem ${sendedMessagesCounter} enviada ${phoneNumber}`)

        let rowCopy = { ...row }
        rowCopy = Object.values(rowCopy)

        rowCopy.push('Enviado')

        callback(null, rowCopy.join(';') + '\n')
      } catch (error) {
        console.log(error)
      }
    })

  input.pipe(transformStream)

  transformStream.on('data', chunk => {
    output.write(chunk)
  })

  transformStream.on('end', () => {
    output.end()
    client.destroy()
  })
}
