const fs = require('fs')
const csv = require('fast-csv')
const qrcode = require('qrcode-terminal')
const { Client } = require('whatsapp-web.js')

const fileName = process.argv[2]
const numberOfSessios = Number(process.argv[3])

let firstRow = true
let sendedMessagesCounter = 0

const timer = (min, max) => {
  const getRandom = (min, max) => {
    return Math.random() * (max - min) + min
  }

  const time = getRandom(min, max)
  console.log(
    `                                         Esperando ${time.toFixed(
      2
    )} segundos`
  )
  return new Promise(resolve => {
    setTimeout(resolve, time * 1000)
  })
}

const clients = {}

const sendMessage = async (phoneNumber, messageText, client) => {
  await client.sendMessage(`${phoneNumber}@c.us`, messageText)
}

const whatsappSessioGenerator = async numberOfSessios => {
  console.log('whatsappSessioGenerator iniciou')

  for (let i = 1; i <= numberOfSessios; i++) {
    clients[`client${i}`] = new Client()

    clients[`client${i}`].on('qr', qr => {
      qrcode.generate(qr, { small: true })
    })

    const readyPromise = new Promise(resolve => {
      clients[`client${i}`].on('ready', () => {
        console.log(`Cliente ${i} está pronto!`)
        resolve()
      })
    })

    clients[`client${i}`].initialize()

    await readyPromise
  }

  fileReader(clients, sendMessage)
}

const fileReader = async (clients, sendMessage) => {
  const input = fs.createReadStream(`./${fileName}.csv`, { encoding: 'utf8' })
  const output = fs.createWriteStream(`./${fileName}Result.csv`, {
    encoding: 'utf8'
  })

  let clientToUse = 1

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
          console.log(row)
          throw new Error('Coluna telefone não encontrada')
        }

        const message = row.mensagem
        // const message = 'alguma coisa'

        await sendMessage(phoneNumber, message, clients[`client${clientToUse}`])
        await timer(1, 5)
        ++sendedMessagesCounter

        console.log(
          `Mensagem ${sendedMessagesCounter} enviada ${phoneNumber} | Pelo whatsapp ${clientToUse}`
        )

        let rowCopy = { ...row }
        rowCopy = Object.values(rowCopy)

        rowCopy.push('Enviado')

        clientToUse = clientToUse === numberOfSessios ? 1 : ++clientToUse

        callback(null, rowCopy.join(';') + '\n')
      } catch (error) {
        console.log(error)
      }
    })

  input.pipe(transformStream)

  transformStream.on('data', chunk => {
    output.write(chunk)
  })

  transformStream.on('end', async () => {
    output.end()
    for (let i = 1; i <= numberOfSessios; i++) {
      await timer(2, 2)
      clients[`client${i}`].destroy()
      console.log(`Whatsapp ${i} Finalizado`)
    }
  })
}

whatsappSessioGenerator(numberOfSessios)
