import express, { Response, Request } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import { config } from 'dotenv'
import cheerio from 'cheerio'
import rp from 'request-promise'
import { WebhookClient, MessageEmbed } from 'discord.js'
import monk from 'monk'
config()

const app = express()
app.use(cors())
app.use(morgan('dev'))

const { whid, whtoken } = process.env
const wh = new WebhookClient(whid, whtoken)

const db = monk(process.env.MONGO_URI)

async function fetchData(username: string) {
    const { body } = await rp({ uri: `https://www.tiktok.com/@${username}`, json: true, resolveWithFullResponse: true, gzip: true, method: 'GET' })
    const $ = cheerio.load(body)
    // @ts-ignore
    const rawData = JSON.parse(await $('script').get().filter(a => a.attribs.id == "__NEXT_DATA__" ? true : false)[0].children[0].data)
    return rawData.props.pageProps
}

async function sendEmbed(data: any) {
    const tiktokAvatar = data.userInfo.user.avatarLarger
    console.log(data.items[0].video)
    const embed = new MessageEmbed({title: 'New video is up', color: 'RANDOM', url: `${data.seoProps.metaParams.canonicalHref}/video/${data.items[0].id}`, description: data.items[0].desc}).setThumbnail(tiktokAvatar).setTimestamp().setImage(data.items[0].video.cover).addField('Link:',`[Click here](${`${data.seoProps.metaParams.canonicalHref}/video/${data.items[0].id}`})`, false)
    wh.send('test', {
        embeds: [embed]
    })
}

async function checker(username: string,data: any) {
    const collection = db.get(username)
    const arrayofid = (data.items).map(e => e.id)
    const dataondb = await collection.find({})
    if(dataondb.length == 0) {
        collection.insert({ videoIds: arrayofid, username: username }).then(e => sendEmbed(data))
    }
    else if(!dataondb[0].videoIds.includes(data.items[0].id)) {
        collection.findOneAndUpdate({ username: username }, { $set: { videoIds: arrayofid } }).then(e => sendEmbed(data))
    }
}

app.all('/', async(req: Request, res: Response) => {
    const { tiktokusername } = process.env;
    const data = await fetchData(tiktokusername)
    checker(tiktokusername, data).then(e => res.send('OK').status(200)).catch(err => console.error)
})


const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Runing at PORT ${PORT}`))