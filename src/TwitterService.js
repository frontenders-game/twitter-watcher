import fs from "fs";
import path from "path";
import {fileURLToPath} from 'url';
import {Scraper} from "agent-twitter-client";
import {Cookie} from "tough-cookie";


// Get the directory name properly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export default class TwitterService {
    constructor(username, password, email) {
        this.username = username;
        this.password = password;
        this.email = email;
        this.scraper = new Scraper();
        this.jsonDir = path.join(__dirname, 'json');
        this.cookiePath = path.join(this.jsonDir, 'cookies.json');
        this.tweetsDir = this.jsonDir
        this.savedTweets = {}
        this.isLoggedIn = false;
    }

    async initialize() {
        // Create directory if it doesn't exist
        await fs.mkdirSync(path.dirname(this.jsonDir), {recursive: true});
        try {
            await this.loadCookies();

            if (!this.isLoggedIn) {
                console.log('Logging in...');
                await this.login();
            }
            console.log('Twitter service initialized!');
            return true
        } catch (error) {
            console.log('Init error:', error);
            throw error;
        }
    }

    async login() {
        try {
            await this.scraper.login(
                this.username,
                this.password,
                this.email
            );
            this.isLoggedIn = true;
            const cookies = await this.scraper.getCookies();
            await this.saveCookies(cookies);
            console.log('Login successful!');
        } catch (error) {
            console.log('Login error:', error);
            throw error;
        }
    }

    async loadCookies() {
        try {
            if (fs.existsSync(this.cookiePath)) {
                const cookiesData = fs.readFileSync(this.cookiePath, 'utf8');
                const cookiesJson = JSON.parse(cookiesData);

                const cookies = cookiesJson.map(cookieData => {
                    try {
                        return Cookie.fromJSON(cookieData).toString(); // Supposed to work without .toString(), but it doesn't
                    } catch (error) {
                        console.error('Failed to parse cookie:', error);
                        return null;
                    }
                }).filter(cookie => cookie !== null);

                if (cookies.length > 0) {
                    await this.scraper.setCookies(cookies);
                    this.isLoggedIn = await this.scraper.isLoggedIn();
                    console.log('Cookies loaded successfully');
                } else {
                    console.log('No valid cookies found');
                    this.isLoggedIn = false;
                }
            } else {
                console.log('No existing cookies found');
            }
        } catch (error) {
            console.error('Cookie loading error:', error);
            this.isLoggedIn = false;
        }
    }

    async saveCookies(cookies) {
        try {
            const cookiesJson = cookies.map(cookie => cookie.toJSON());
            await fs.writeFileSync(this.cookiePath, JSON.stringify(cookiesJson, null, 2));
            console.log('Cookies saved successfully');
        } catch (error) {
            console.error('Cookie saving error:', error);
        }
    }

    // async processTweetData(tweet) {
    //     try {
    //         console.log('------------------------------')
    //         console.log(tweet)
    //         if (!tweet || !tweet.id) return null;
    //
    //         let timestamp = tweet.timestamp;
    //         if (!timestamp) {
    //             timestamp = tweet.timeParsed?.getTime();
    //         }
    //
    //         if (!timestamp) return null;
    //
    //         if (timestamp < 1e12) timestamp *= 1000;
    //
    //         if (isNaN(timestamp) || timestamp <= 0) {
    //             console.log(`Invalid timestamp for tweet ${tweet.id}`);
    //             return null;
    //         }
    //
    //         return {
    //             id: tweet.id,
    //             text: tweet.text,
    //             username: tweet.username || 'unknown',
    //             timestamp,
    //             createdAt: new Date(timestamp).toISOString(),
    //             isReply: Boolean(tweet.isReply),
    //             isRetweet: Boolean(tweet.isRetweet),
    //             likes: tweet.likes || 0,
    //             retweetCount: tweet.retweets || 0,
    //             replies: tweet.replies || 0,
    //             photos: tweet.photos || [],
    //             videos: tweet.videos || [],
    //             urls: tweet.urls || [],
    //             permanentUrl: tweet.permanentUrl,
    //             quotedStatusId: tweet.quotedStatusId,
    //             inReplyToStatusId: tweet.inReplyToStatusId,
    //             hashtags: tweet.hashtags || [],
    //         };
    //     } catch (error) {
    //         console.log(`Error processing tweet ${tweet?.id}: ${error.message}`);
    //         return null;
    //     }
    // }

    async loadTweets(name) {
        const filePath = path.join(this.tweetsDir, `tweets-by-${name}.json`)
        if (fs.existsSync(filePath)) {
            const tweets = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            console.log(`Total tweets read from file for ${name}: ${tweets.length}`)
            return tweets;
        }
        return null;
    }


    async saveTweets(name, tweets) {
        if (tweets.length > 0) {
            try {
                const filePath = path.join(this.tweetsDir, `tweets-by-${name}.json`)
                fs.writeFileSync(filePath, JSON.stringify(tweets, null, 2));
                console.log(`Total tweets written to file for ${name}: ${tweets.length}.`)
            } catch (error) {
                console.error('Tweets saving error:', error);
            }
        } else {
            console.log('No tweets to save for ', name);
        }
    }

    async getNewTweets(name, count = 10) {
        // check scraper
        if (!this.isLoggedIn) {
            const scraperInitialized = await this.initialize();
            if (!scraperInitialized) {
                throw new Error('Failed to initialize Twitter scraper');
            }
        }

        // Get tweets using async iterator
        const tweets = [];
        const tweetsIterator = this.scraper.getTweets(name, count);

        for await (const tweet of tweetsIterator) {
            // tweets.push(await this.processTweetData(tweet));
            tweets.push(tweet);
        }
        return tweets;
    }

    async getDiffTweets(name, count = 20) {
        const newTweets = await this.getNewTweets(name, count);
        const oldTweets =  this.savedTweets.name ? this.savedTweets.name : await this.loadTweets(name);

        if (oldTweets && oldTweets.length > 0 && newTweets.length > 0) {
            const diffTweets = await this.compareTweets(oldTweets, newTweets);
            // save to memory
            this.savedTweets.name = newTweets;
            // save new json only if new tweet posted.
            if (diffTweets.length > 0) {
                await this.saveTweets(name, newTweets);
            }
            return diffTweets;
        } else if ((!oldTweets || oldTweets.length > 0) && newTweets.length > 0) {
            console.log('No old tweets found.');
            await this.saveTweets(name, newTweets);
        }
        return [];
    }

    async compareTweets(oldTweets, newTweets) {
        const latestTimestamp = oldTweets[0].timestamp;
        return newTweets.filter(tweet => tweet.timestamp > latestTimestamp);
    }
}
