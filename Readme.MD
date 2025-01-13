# About
Simple bot that forwards messages from single 𝕏 (twitter) account to telegram group. 

# Settings
Register new 𝕏 (twitter) account for twitter and fill .env file as written in .env.example:

`TWITTER_USERNAME` - your login\
`TWITTER_PASSWORD` - account password\
`TWITTER_EMAIL` - account email\
`TWITTER_NAME_TO_FOLLOW` - account you want to follow\
`TWITTER_REFRESH_TIME_MINUTES`- check for new tweets every N minutes

`TELEGRAM_BOT_TOKEN` - bot token. Get it from `@BotFather`\
`TELEGRAM_CHAT_ID` - chat id where to send messages\
`TELEGRAM_MESSAGE_THREAD_ID` - topic id in this chat\
`TELEGRAM_ADMIN_ID` - your id. Comment lines 23-27 in `bot.js` if you don't want this welcome message.


# Setup on server
```
apt update
apt upgrade
```

install nvm https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating
```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

install nodejs with nvm
```
nvm install 22.13.0
```

install git
```
apt install git
```
create directory for project
```
cd /home/
mkdir bots
cd bots
```

clone repository
```
git clone https://github.com/frontenders-game/twitter-watcher.git
```

go to project directory
```
cd twitter-watcher/
```

copy .env.example 
```
cp .env.example.env
```
edit .env with your settings, ctrl+o to save
```
nano .env
```

install dependencies
```
npm install
```



# Working in background with systemd and autorestart
make config
```
nano /lib/systemd/system/twitter-watcher.service
```
paste 
```
[Unit]
Description=Twitter Watcher Service
# start the app after the network is available
After=After=multi-user.target
Conflicts=getty@tty1.service

[Service]
Type=simple
WorkingDirectory=/home/bots/twitter-watcher
ExecStart=/root/.nvm/versions/node/v22.13.0/bin/node /home/bots/twitter-watcher/src/bot.js
StandardInput=tty-force
StandardOutput=file:/var/log/twitter-watcher_log.log
StandardError=file:/var/log/twitter-watcher_error.log
Restart=always

[Install]
WantedBy=multi-user.target
```

reload list of services
```
systemctl daemon-reload
```
enable service
```
systemctl enable twitter-watcher.service
```
run it
```
systemctl start twitter-watcher.service
```
###

other useful commands
```
systemctl status twitter-watcher.service 
systemctl stop twitter-watcher.service 
systemctl start twitter-watcher.service 
systemctl restart twitter-watcher.service 
```