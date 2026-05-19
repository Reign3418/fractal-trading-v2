import { Ripple } from '../lib/ripple';
import { Basin } from '../lib/basin';
import { AnalysisResult, IndicatorValue, DetectorReading } from '../types';

interface AnalysisOceanConfig {
  nodeName?: string;
  exchangeClient: any;
}

interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * AnalysisOcean -- Technical analysis node for the fractal terrain trading architecture.
 * Computes RSI, MACD, EMA, Bollinger Bands, ATR, trend detection,
 * and a 5-detector early warning system.
 */
export class AnalysisOcean {
  nodeName: string = 'analysis-ocean';
  elevation = 250;
  terrain = 'ocean' as const;
  basin: Basin;
  exchangeClient: any;
  analysisHistory: Map<string, AnalysisResult[]>;
  indicators: Map<string, IndicatorValue[]>;
  analysisCount: number;

  constructor(config: AnalysisOceanConfig) {
    this.nodeName = config.nodeName || 'analysis-ocean';
    this.exchangeClient = config.exchangeClient;
    this.basin = new Basin({
      nodeName: this.nodeName,
      terrain: 'ocean',
      depth: 1000,
      absorptionRate: 0.80,
      overflowThreshold: 0.85,
    });
    this.analysisHistory = new Map();
    this.indicators = new Map();
    this.analysisCount = 0;
  }

  /* Core: handle incoming ripples */
  async receive(ripple: Ripple): Promise<any> {
    const result = this.basin.receive(ripple);

    if (ripple.type === 'HEARTBEAT') {
      const assets = (ripple.payload.assets as string[]) || ['BTC', 'ETH', 'SOL'];
      const results: AnalysisResult[] = [];
      for (const asset of assets) {
        try {
          const analysis = await this.analyze(asset);
          results.push(analysis);
        } catch (err: any) {
          console.error(`[${this.nodeName}] Analysis failed for ${asset}: ${err.message}`);
        }
      }
      return { analyzed: results.length, results };
    }

    if (ripple.type === 'FLOW' || ripple.type === 'INLET' || ripple.type === 'ALERT') {
      const asset = ripple.payload.asset as string;
      if (asset) {
        try {
          const analysis = await this.analyze(asset);
          return {
            analysis,
            ...result,
            isOverflowing: this.basin.checkOverflow(),
          };
        } catch (err: any) {
          console.error(`[${this.nodeName}] Analysis failed for ${asset}: ${err.message}`);
          return { error: err.message, ...result };
        }
      }
    }

    return result;
  }

  /* Main analysis pipeline */
  async analyze(asset: string): Promise<AnalysisResult> {
    const ohlcv: OHLCV[] = await this.exchangeClient.getOHLCV(asset, '1h', 100);
    if (!ohlcv || ohlcv.length < 55) {
      throw new Error(
        `Insufficient OHLCV data for ${asset}: got ${ohlcv?.length || 0} candles, need >= 55`
      );
    }

    const closes = ohlcv.map((c) => c.close);
    const highs = ohlcv.map((c) => c.high);
    const lows = ohlcv.map((c) => c.low);
    const volumes = ohlcv.map((c) => c.volume);
    const currentPrice = closes[closes.length - 1];

    const rsi = this.computeRSI(closes, 14);
    const ema20 = this.computeEMA(closes, 20);
    const ema50 = this.computeEMA(closes, 50);
    const macdResult = this.computeMACD(closes);
    const bb = this.computeBollingerBands(closes, 20, 2);
    const atr = this.computeATR(highs, lows, closes, 14);

    const indicatorValues: IndicatorValue[] = [
      {
        name: 'RSI(14)',
        value: parseFloat(rsi.toFixed(2)),
        signal: rsi > 70 ? 'bearish' : rsi < 30 ? 'bullish' : 'neutral',
        timestamp: Date.now(),
      },
      {
        name: 'MACD',
        value: parseFloat(macdResult.histogram[macdResult.histogram.length - 1].toFixed(4)),
        signal: macdResult.histogram[macdResult.histogram.length - 1] > 0
          ? 'bullish'
          : macdResult.histogram[macdResult.histogram.length - 1] < 0
            ? 'bearish'
            : 'neutral',
        timestamp: Date.now(),
      },
      {
        name: 'EMA20/50_Trend',
        value: parseFloat((ema20[ema20.length - 1] / ema50[ema50.length - 1] - 1).toFixed(4)),
        signal: ema20[ema20.length - 1] > ema50[ema50.length - 1] ? 'bullish' : 'bearish',
        timestamp: Date.now(),
      },
      {
        name: 'Bollinger_Bands',
        value: parseFloat(currentPrice.toFixed(2)),
        signal:
          currentPrice > bb.upper ? 'bearish' : currentPrice < bb.lower ? 'bullish' : 'neutral',
        timestamp: Date.now(),
      },
      {
        name: 'ATR(14)',
        value: parseFloat(atr.toFixed(4)),
        signal: atr / currentPrice > 0.03 ? 'bearish' : 'neutral',
        timestamp: Date.now(),
      },
    ];

    const trend = this.detectTrend(closes);

    const detectors: DetectorReading[] = [
      this.detectVolatility(atr, currentPrice),
      this.detectMomentum(rsi),
      this.detectVolume(volumes),
      this.detectSupportResistance(currentPrice, closes),
      this.detectSentiment(ohlcv),
    ];

    const { signal: overallSignal, confidence } = this.aggregateOverallSignal(indicatorValues);

    const result: AnalysisResult = {
      asset,
      timestamp: Date.now(),
      indicators: indicatorValues,
      detectors,
      overallSignal,
      confidence: parseFloat(confidence.toFixed(4)),
      price: currentPrice,
    };

    if (!this.analysisHistory.has(asset)) {
      this.analysisHistory.set(asset, []);
    }
    const history = this.analysisHistory.get(asset)!;
    history.push(result);
    if (history.length > 1000) {
      this.analysisHistory.set(asset, history.slice(-500));
    }

    if (!this.indicators.has(asset)) {
      this.indicators.set(asset, []);
    }
    const indHistory = this.indicators.get(asset)!;
    indHistory.push(...indicatorValues);
    if (indHistory.length > 5000) {
      this.indicators.set(asset, indHistory.slice(-2500));
    }

    this.analysisCount++;
    return result;
  }

  /* Technical Indicators */

  computeRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) {
      throw new Error(`RSI requires at least ${period + 1} prices, got ${prices.length}`);
    }

    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const gains = changes.map((c) => (c > 0 ? c : 0));
    const losses = changes.map((c) => (c < 0 ? Math.abs(c) : 0));

    let avgGain = this.mean(gains.slice(0, period));
    let avgLoss = this.mean(losses.slice(0, period));

    for (let i = period; i < changes.length; i++) {
      const gain = changes[i] > 0 ? changes[i] : 0;
      const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  computeEMA(prices: number[], period: number): number[] {
    if (prices.length < period) {
      throw new Error(`EMA requires at least ${period} prices, got ${prices.length}`);
    }

    const multiplier = 2 / (period + 1);
    const ema: number[] = [];
    const firstSMA = this.mean(prices.slice(0, period));
    ema.push(firstSMA);

    for (let i = period; i < prices.length; i++) {
      const prevEMA = ema[ema.length - 1];
      ema.push(prices[i] * multiplier + prevEMA * (1 - multiplier));
    }

    return ema;
  }

  computeMACD(prices: number[]): { macd: number[]; signal: number[]; histogram: number[] } {
    if (prices.length < 26) {
      throw new Error(`MACD requires at least 26 prices, got ${prices.length}`);
    }

    const ema12 = this.computeEMA(prices, 12);
    const ema26 = this.computeEMA(prices, 26);

    const macdLine: number[] = [];
    const startIdx = ema26.length - ema12.length;
    for (let i = 0; i < ema12.length; i++) {
      const e26Idx = i + startIdx;
      if (e26Idx >= 0 && e26Idx < ema26.length) {
        macdLine.push(ema12[i] - ema26[e26Idx]);
      }
    }

    const signalLine = this.computeEMA(macdLine, 9);

    const histogram: number[] = [];
    const signalStart = macdLine.length - signalLine.length;
    for (let i = 0; i < signalLine.length; i++) {
      histogram.push(macdLine[i + signalStart] - signalLine[i]);
    }

    return { macd: macdLine, signal: signalLine, histogram };
  }

  computeBollingerBands(
    prices: number[],
    period: number = 20,
    stdDev: number = 2
  ): { upper: number; middle: number; lower: number } {
    if (prices.length < period) {
      throw new Error(`Bollinger Bands require at least ${period} prices, got ${prices.length}`);
    }

    const slice = prices.slice(-period);
    const middle = this.mean(slice);
    const sd = this.stdDev(slice);

    return {
      upper: middle + sd * stdDev,
      middle,
      lower: middle - sd * stdDev,
    };
  }

  computeATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14
  ): number {
    if (
      highs.length < period + 1 ||
      lows.length < period + 1 ||
      closes.length < period + 1
    ) {
      throw new Error(`ATR requires at least ${period + 1} candles`);
    }

    const trueRanges: number[] = [];
    for (let i = 1; i < highs.length; i++) {
      const highLow = highs[i] - lows[i];
      const highPrevClose = Math.abs(highs[i] - closes[i - 1]);
      const lowPrevClose = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(highLow, highPrevClose, lowPrevClose));
    }

    return this.mean(trueRanges.slice(-period));
  }

  computeSMA(prices: number[], period: number): number {
    if (prices.length < period) {
      throw new Error(`SMA requires at least ${period} prices, got ${prices.length}`);
    }
    return this.mean(prices.slice(-period));
  }

  /* Signal interpretation */

  detectTrend(prices: number[]): 'uptrend' | 'downtrend' | 'sideways' {
    if (prices.length < 50) {
      throw new Error(`Trend detection requires at least 50 prices, got ${prices.length}`);
    }

    const ema20 = this.computeEMA(prices, 20);
    const ema50 = this.computeEMA(prices, 50);

    const lastEma20 = ema20[ema20.length - 1];
    const lastEma50 = ema50[ema50.length - 1];

    const diff = Math.abs(lastEma20 - lastEma50) / lastEma50;
    if (diff < 0.005) return 'sideways';

    return lastEma20 > lastEma50 ? 'uptrend' : 'downtrend';
  }

  /* 5-Detector System */

  detectVolatility(atr: number, price: number): DetectorReading {
    const ratio = atr / price;
    let status: DetectorReading['status'];
    let message: string;

    if (ratio > 0.03) {
      status = 'critical';
      message = `Extreme volatility: ATR/Price = ${(ratio * 100).toFixed(2)}%`;
    } else if (ratio > 0.015) {
      status = 'warning';
      message = `Elevated volatility: ATR/Price = ${(ratio * 100).toFixed(2)}%`;
    } else {
      status = 'normal';
      message = `Volatility normal: ATR/Price = ${(ratio * 100).toFixed(2)}%`;
    }

    return {
      name: 'volatility',
      status,
      value: parseFloat(ratio.toFixed(4)),
      threshold: 0.03,
      message,
    };
  }

  detectMomentum(rsi: number): DetectorReading {
    let status: DetectorReading['status'];
    let message: string;

    if (rsi < 20 || rsi > 80) {
      status = 'critical';
      message = `Extreme momentum: RSI = ${rsi.toFixed(2)} (${rsi < 20 ? 'oversold' : 'overbought'})`;
    } else if (rsi < 30 || rsi > 70) {
      status = 'warning';
      message = `Strong momentum: RSI = ${rsi.toFixed(2)} (${rsi < 30 ? 'oversold' : 'overbought'})`;
    } else {
      status = 'normal';
      message = `Momentum neutral: RSI = ${rsi.toFixed(2)}`;
    }

    return {
      name: 'momentum',
      status,
      value: parseFloat(rsi.toFixed(2)),
      threshold: 70,
      message,
    };
  }

  detectVolume(volumes: number[]): DetectorReading {
    if (!volumes || volumes.length < 2) {
      return {
        name: 'volume',
        status: 'normal',
        value: 0,
        threshold: 2,
        message: 'Insufficient volume data',
      };
    }

    const lastVolume = volumes[volumes.length - 1];
    const avgVolume = this.mean(volumes.slice(0, -1));

    if (avgVolume === 0) {
      return {
        name: 'volume',
        status: 'normal',
        value: 0,
        threshold: 2,
        message: 'Average volume is zero',
      };
    }

    const ratio = lastVolume / avgVolume;
    let status: DetectorReading['status'];
    let message: string;

    if (ratio > 3) {
      status = 'critical';
      message = `Volume spike: ${ratio.toFixed(2)}x average`;
    } else if (ratio > 2) {
      status = 'warning';
      message = `Volume above average: ${ratio.toFixed(2)}x`;
    } else if (ratio < 0.3) {
      status = 'warning';
      message = `Volume depressed: ${ratio.toFixed(2)}x average`;
    } else {
      status = 'normal';
      message = `Volume normal: ${ratio.toFixed(2)}x average`;
    }

    return {
      name: 'volume',
      status,
      value: parseFloat(ratio.toFixed(2)),
      threshold: 2,
      message,
    };
  }

  detectSupportResistance(price: number, prices: number[]): DetectorReading {
    if (!prices || prices.length < 20) {
      return {
        name: 'support_resistance',
        status: 'normal',
        value: 0,
        threshold: 0.025,
        message: 'Insufficient price history for S/R detection',
      };
    }

    const windowSize = 5;
    const srLevels: number[] = [];

    for (let i = windowSize; i < prices.length - windowSize; i++) {
      const isMin =
        prices.slice(i - windowSize, i).every((p) => p >= prices[i]) &&
        prices.slice(i + 1, i + windowSize + 1).every((p) => p >= prices[i]);
      const isMax =
        prices.slice(i - windowSize, i).every((p) => p <= prices[i]) &&
        prices.slice(i + 1, i + windowSize + 1).every((p) => p <= prices[i]);

      if (isMin || isMax) {
        srLevels.push(prices[i]);
      }
    }

    if (srLevels.length === 0) {
      const recent = prices.slice(-30);
      srLevels.push(Math.min(...recent), Math.max(...recent));
    }

    const distances = srLevels.map((level) => Math.abs(price - level) / price);
    const nearestDistance = Math.min(...distances);

    let status: DetectorReading['status'];
    let message: string;

    if (nearestDistance < 0.01) {
      status = 'critical';
      message = `Price at S/R level: ${(nearestDistance * 100).toFixed(2)}% away`;
    } else if (nearestDistance < 0.025) {
      status = 'warning';
      message = `Price near S/R level: ${(nearestDistance * 100).toFixed(2)}% away`;
    } else {
      status = 'normal';
      message = `Price clear of S/R: ${(nearestDistance * 100).toFixed(2)}% away`;
    }

    return {
      name: 'support_resistance',
      status,
      value: parseFloat(nearestDistance.toFixed(4)),
      threshold: 0.025,
      message,
    };
  }

  detectSentiment(ohlcv: OHLCV[]): DetectorReading {
    if (!ohlcv || ohlcv.length < 5) {
      return {
        name: 'sentiment',
        status: 'normal',
        value: 0,
        threshold: 5,
        message: 'Insufficient candle data for sentiment detection',
      };
    }

    const last5 = ohlcv.slice(-5);
    const greenCount = last5.filter((c) => c.close > c.open).length;
    const redCount = last5.filter((c) => c.close < c.open).length;

    let status: DetectorReading['status'];
    let message: string;
    let value: number;

    if (greenCount === 5) {
      status = 'warning';
      value = 5;
      message = 'Bullish sentiment: 5 consecutive green candles';
    } else if (redCount === 5) {
      status = 'warning';
      value = -5;
      message = 'Bearish sentiment: 5 consecutive red candles';
    } else {
      status = 'normal';
      value = greenCount - redCount;
      message = `Mixed sentiment: ${greenCount} green, ${redCount} red (last 5)`;
    }

    return {
      name: 'sentiment',
      status,
      value,
      threshold: 5,
      message,
    };
  }

  /* Overall signal aggregation */

  aggregateOverallSignal(
    indicatorValues: IndicatorValue[]
  ): { signal: AnalysisResult['overallSignal']; confidence: number } {
    let bullishCount = 0;
    let bearishCount = 0;
    let totalWeight = 0;

    const weights: Record<string, number> = {
      'RSI(14)': 1.0,
      MACD: 1.2,
      'EMA20/50_Trend': 1.5,
      Bollinger_Bands: 0.8,
      'ATR(14)': 0.5,
    };

    for (const ind of indicatorValues) {
      const w = weights[ind.name] || 1;
      if (ind.signal === 'bullish') {
        bullishCount += w;
        totalWeight += w;
      } else if (ind.signal === 'bearish') {
        bearishCount += w;
        totalWeight += w;
      } else {
        totalWeight += w * 0.5;
      }
    }

    const bullishRatio = bullishCount / totalWeight;
    const bearishRatio = bearishCount / totalWeight;

    let signal: AnalysisResult['overallSignal'];
    let confidence: number;

    if (bullishRatio >= 0.6) {
      signal = bullishRatio >= 0.75 ? 'strong_buy' : 'buy';
      confidence = bullishRatio;
    } else if (bearishRatio >= 0.6) {
      signal = bearishRatio >= 0.75 ? 'strong_sell' : 'sell';
      confidence = bearishRatio;
    } else {
      signal = 'neutral';
      confidence = 1 - Math.abs(bullishRatio - bearishRatio);
    }

    return { signal, confidence };
  }

  /* Helpers */

  getAnalysisHistory(asset: string, limit: number = 10): AnalysisResult[] {
    const history = this.analysisHistory.get(asset) || [];
    return history.slice(-limit);
  }

  getStats(): {
    nodeName: string;
    terrain: string;
    elevation: number;
    analysisCount: number;
    trackedAssets: string[];
    totalHistoryEntries: number;
    basin: any;
  } {
    let totalHistoryEntries = 0;
    for (const entries of this.analysisHistory.values()) {
      totalHistoryEntries += entries.length;
    }

    return {
      nodeName: this.nodeName,
      terrain: this.terrain,
      elevation: this.elevation,
      analysisCount: this.analysisCount,
      trackedAssets: Array.from(this.analysisHistory.keys()),
      totalHistoryEntries,
      basin: this.basin.snapshot(),
    };
  }

  getBasinSnapshot(): any {
    return this.basin.snapshot();
  }

  /* Math helpers */

  private stdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.mean(values);
    const sqDiffs = values.map((v) => (v - avg) ** 2);
    return Math.sqrt(this.mean(sqDiffs));
  }

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }
}
