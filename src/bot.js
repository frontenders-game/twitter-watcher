import path from "path";
import dotenv from 'dotenv';
import {Bot, InlineKeyboard} from 'grammy'
import TwitterService from "./TwitterService.js";

const TIME_INTERVAL = 2 * 60 * 1000 // Checks every 2 minutes
const TIMEOUT = 15 * 60 * 1000 // Checks every 2 minutes
// const TELEGRAM_MAX_MESSAGE_LENGTH = 4096 // set by telegram
// const TELEGRAM_MAX_CAPTION_LENGTH = 1024 // set by telegram

// getting private data
const ROOT_DIRECTORY = path.dirname(import.meta.dirname);
dotenv.config({path: `${ROOT_DIRECTORY}/.env`});


const twitterService = new TwitterService(
    process.env.TWITTER_USERNAME,
    process.env.TWITTER_PASSWORD,
    process.env.TWITTER_EMAIL
);

await twitterService.initialize();


const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

try {
    await bot.api.sendMessage(process.env.TELEGRAM_ADMIN_ID, 'I am starting to work.')
} catch (error){
    console.error("Couldn't send welcome message to admin: ", error)
}

const chatId = process.env.TELEGRAM_CHAT_ID;
const twitterName = process.env.TWITTER_NAME_TO_FOLLOW


setInterval(async () => {
    // Get tweets by account since the last check
    try {
        const newTweets = await twitterService.getDiffTweets(twitterName);
        newTweets.reverse(); // old tweets first
        for (const tweet of newTweets) {
            console.log(tweet)
            console.log('--- END OF TWEET ---');
            // Do not forward replies
            if (tweet.isReply) continue

            const profileUrl = `https://x.com/${twitterName}/`
            const tweetUrl = `${profileUrl}status/${tweet.id}`
            const titleType = tweet.isRetweet ? "retweeted 🔁" : tweet.isQuoted ? 'quoted 📝' : "tweeted ✏️"
            const title = `<a href="${profileUrl}">${twitterName}</a> <b>${titleType}:</b>`
            let text = `${title}\n\n${tweet.text}`;

            // Replace Telegram alias to Twitter direct links in order to avoid scams
            const mentions = text.matchAll(/\@(\w+)/g)
            for (const mention of mentions) {
                text = text.replace(mention[0], `<a href="https://x.com/${mention[1]}">${mention[0]}</a>`)
            }

            // construct inlineButton
            const raidText = '🔥 RAID IT NOW 🚀'
            const keyboard = new InlineKeyboard().url(raidText, tweetUrl);
            const otherOptions = {
                reply_markup: keyboard,
                parse_mode: 'HTML',
                message_thread_id: process.env.TELEGRAM_MESSAGE_THREAD_ID,
                link_preview_options: {
                    is_disabled: false,
                    prefer_large_media: true
                }
            }

            let sentMessage;

            // Note that we are checking tweet.text, not text. This is because we insert mentions in the text that are no useful urls
            if (!tweet.isRetweet && !tweet.isQuoted) {
                otherOptions.caption = text;
                if ((tweet.photos.length + tweet.videos.length) > 1) { // 2 or more media
                    const mediaPhotos = tweet.photos.map(media => {
                        return {
                            media: media.url,
                            type: "photo"
                        }
                    });

                    const mediaVideos = tweet.videos.map(media => {
                        return {
                            media: media.url,
                            type: "video"
                        }
                    });

                    const media = mediaPhotos.concat(mediaVideos).slice(0, 10); // using only first 10
                    media[0].parse_mode = 'HTML';
                    media[0].caption = text + `\n\n<a href="${tweetUrl}">${raidText}</a>`;
                    sentMessage = await bot.api.sendMediaGroup(chatId, media, otherOptions)

                } else {
                    otherOptions.caption = text
                    if (tweet.photos.length > 0) {
                        sentMessage = await bot.api.sendPhoto(chatId, tweet.photos[0].url, otherOptions)
                    } else if (tweet.videos.length > 0) {
                        sentMessage = await bot.api.sendVideo(chatId, tweet.videos[0].url, otherOptions)
                    }
                }
            } else {  // usual message
                if (tweet.isRetweet) {
                    otherOptions.link_preview_options.url = tweet.retweetedStatus.permanentUrl
                } else if (tweet.isQuoted) {
                    otherOptions.link_preview_options.url = tweet.quotedStatus.permanentUrl
                } else if (tweet.urls.length > 0) {
                    otherOptions.link_preview_options.url = tweet.urls[0]
                } else {
                    otherOptions.link_preview_options.is_disabled = true
                }
                sentMessage = await bot.api.sendMessage(chatId, text, otherOptions)
            }
            console.log('message sent: ', sentMessage)
        }
    } catch (error) {
        console.error("Got error ", error)
        console.log("Sleeping ms: ", TIMEOUT)
        twitterService.isLoggedIn = false;
        setTimeout(() => {
            console.log("Lets go ", TIMEOUT);
        }, TIMEOUT);
    }
}, TIME_INTERVAL)
