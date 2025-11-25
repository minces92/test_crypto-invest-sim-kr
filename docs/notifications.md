# Notifications Setup

This application can send real-time notifications for new trades and significant news articles via Telegram.

## How It Works

- **Trade Notifications**: Every time a new trade (buy or sell) is executed, either manually or by an auto-trading strategy, a detailed notification is sent to your specified Telegram chat.
- **News Notifications**: The system periodically fetches cryptocurrency news. When a new article is identified as significant (classified with 'positive' or 'negative' sentiment), a notification is sent. This helps you stay on top of market-moving news. Duplicate news notifications are automatically prevented.
  
  Note: By default the system searches for a set of common crypto keywords (English and Korean). The default query now includes: `cryptocurrency`, `bitcoin`, `ethereum`, and Korean keywords `암호화폐`, `코인`.

## Configuration

To enable Telegram notifications, you must configure a Telegram Bot and provide its credentials to the application via environment variables.

### 1. Create a Telegram Bot

1.  Open Telegram and search for the `@BotFather` user.
2.  Start a chat with BotFather and send the `/newbot` command.
3.  Follow the instructions to choose a name and username for your bot.
4.  BotFather will provide you with a **Bot Token**. Copy this token.

### 2. Get Your Chat ID

1.  **For Personal Notifications**:
    - Search for the `@userinfobot` on Telegram.
    - Start a chat, and it will immediately reply with your user information, including your **Chat ID**.
2.  **For Group Notifications**:
    - Create a new group in Telegram.
    - Add the bot you created in step 1 to this group.
    - Send at least one message to the group.
    - Open the following URL in your browser, replacing `<YOUR_BOT_TOKEN>` with the token you received:
      `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
    - Look for the `chat` object in the response. The `id` field within this object is your group's Chat ID (it usually starts with a hyphen `-`).

### 3. Set Environment Variables

Create a file named `.env.local` in the root directory of the project if it doesn't already exist. Add the following lines to it, replacing the placeholder values with your actual credentials:

```env
# Telegram Bot API Token from @BotFather
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# Your personal or group Chat ID
TELEGRAM_CHAT_ID=6465057677

# The URL of your application for links in notifications
SITE_URL=http://localhost:3000
```

### 4. Restart the Application

After creating or modifying the `.env.local` file, you must restart the application for the changes to take effect.

Once restarted, the application will automatically start sending notifications to your configured Telegram chat.
