import path from "path";
import dotenv from 'dotenv';
import {Bot, InlineKeyboard} from 'grammy'
import TwitterService from "./TwitterService.js";

// getting private data
const ROOT_DIRECTORY = path.dirname(import.meta.dirname);
dotenv.config({path: `${ROOT_DIRECTORY}/.env`});

const REFRESH_TIME_INTERVAL = process.env.TWITTER_REFRESH_TIME_MINUTES * 60 * 1000 // Checks every N minutes
const TIMEOUT = 15 * 60 * 1000


const twitterService = new TwitterService(
    process.env.TWITTER_USERNAME,
    process.env.TWITTER_PASSWORD,
    process.env.TWITTER_EMAIL
);


const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

try {
    await bot.api.sendMessage(process.env.TELEGRAM_ADMIN_ID, 'I am starting to work.')
} catch (error) {
    console.error("Couldn't send welcome message to admin: ", error)
}

const chatId = process.env.TELEGRAM_CHAT_ID;
const twitterName = process.env.TWITTER_NAME_TO_FOLLOW


await twitterService.initialize();


setInterval(async () => {
    // Get tweets by account since the last check
    try {
        const newTweets = await twitterService.getDiffTweets(twitterName);
        // old tweets first
        newTweets.reverse();
        for (const tweet of newTweets) {
            let sentMessage;
            try {
                console.log('New tweet: ', tweet);

                // Do not forward replies
                if (tweet.isReply) continue

                const profileUrl = `https://x.com/${twitterName}/`
                const tweetUrl = `${profileUrl}status/${tweet.id}`
                const titleType = tweet.isRetweet ? "retweeted 🔁" : tweet.isQuoted ? 'quoted 📝' : "tweeted ✏️"
                const title = `<a href="${profileUrl}">${twitterName}</a> <b>${titleType}:</b>`
                let text = `${title}\n\n${tweet.text}`;

                // Replace Telegram alias to Twitter direct links in order to avoid confusion and possible scams
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

                if (!tweet.isRetweet && !tweet.isQuoted && (tweet.photos.length + tweet.videos.length > 0)) {
                    otherOptions.caption = text;
                    if ((tweet.photos.length + tweet.videos.length) > 1) { // 2 or more media send as album
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
                    } else {  // 1 photo or video in tweet
                        otherOptions.caption = text
                        if (tweet.photos.length > 0) {  // 1 photo
                            sentMessage = await bot.api.sendPhoto(chatId, tweet.photos[0].url, otherOptions)
                        } else if (tweet.videos.length > 0) { // else 1 video
                            sentMessage = await bot.api.sendVideo(chatId, tweet.videos[0].url, otherOptions)
                        }
                    }
                } else {  // usual sendMessage
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
            } catch (error) {
                console.error("Couldn't send message. Sending simple msg without parse_mode. Error: ", error)
                sentMessage = await bot.api.sendMessage(chatId, `${tweet.permanentUrl}:\n\n${tweet.text}`)
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
}, REFRESH_TIME_INTERVAL)
