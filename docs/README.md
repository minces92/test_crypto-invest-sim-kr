# Crypto Invest Sim Documentation

Welcome to the official documentation for the `crypto-invest-sim-kr` project. This directory contains all the necessary information regarding the project's features, architecture, and configuration.

## Features

This project is a cryptocurrency investment simulator with the following key features:

- **Real-time Data**: Fetches and displays real-time ticker information for major cryptocurrencies.
- **Portfolio Management**: Tracks cash, assets, and transaction history.
- **Auto-Trading Strategies**: Supports various automated trading strategies like DCA, RSI, and more.
- **AI-Powered Analysis**: Utilizes an AI backend (Ollama) to analyze trades and market conditions.
- **Interactive Charts**: Provides detailed charts with selectable time intervals and technical indicators.
- **Real-time Notifications**: Sends alerts for new trades and significant news via Telegram.

## Configuration & Guides

Detailed guides for configuring and using specific features are available:

- **[Performance Tuning](./performance-tuning.md)**: Learn how to adjust the application's data refresh rate for your system.
- **[Telegram Notifications](./notifications.md)**: A step-by-step guide to setting up real-time alerts for trades and news.
- **[Ollama AI Setup](./ollama-installation-guide.md)**: Instructions for setting up the Ollama AI backend for analysis features.

## API Reference

The backend API provides endpoints for fetching data and managing the simulation.

- **[Tickers](./api/tickers.md)**: Fetches real-time price data.
- **[Candles](./api/candles.md)**: Provides chart data for different time intervals.
- **[Transactions](./api/transactions.md)**: Manages the transaction history.
- **[Strategies](./api/strategies.md)**: Manages auto-trading strategies.
- **[AI Analysis](./api/analyze-trade.md)**: Endpoints for AI-powered analysis.

## Component Library

(This section is a work in progress and will be updated with details about the frontend components.)

- **[ChartComponent](./components/ChartComponent.md)**
- **[AutoTrader](./components/AutoTrader.md)**
- **[Portfolio](./components/Portfolio.md)**
- **[TransactionHistory](./components/TransactionHistory.md)**