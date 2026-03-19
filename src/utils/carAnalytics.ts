import type { CarRecord } from '../data/sampleCars';

export type CarStats = {
  count: number;
  price: {
    min: number;
    max: number;
    median: number;
    average: number;
  };
  mileage: {
    min: number;
    max: number;
    median: number;
    average: number;
  };
};

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
};

const medianOf = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const averageOf = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const buildStats = (cars: CarRecord[]): CarStats => {
  const prices = cars.map((car) => toNumber(car.price_raw ?? car.price));
  const mileages = cars.map((car) => toNumber(car.mileage));

  return {
    count: cars.length,
    price: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
      median: medianOf(prices),
      average: averageOf(prices),
    },
    mileage: {
      min: mileages.length ? Math.min(...mileages) : 0,
      max: mileages.length ? Math.max(...mileages) : 0,
      median: medianOf(mileages),
      average: averageOf(mileages),
    },
  };
};

export const getDealRating = (price: number, median: number) => {
  if (!median) return 'Fair';
  if (price <= median * 0.9) return 'Good Purchase';
  if (price <= median * 1.1) return 'Fair';
  return 'Bad Deal';
};

export const formatCurrency = (value: number) =>
  `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)} ₮`;

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

export const weightedAveragePriceByMileage = (cars: CarRecord[]) => {
  if (!cars.length) return 0;
  const maxKm = 300000;
  let weightedSum = 0;
  let weightTotal = 0;
  cars.forEach((car) => {
    const price = toNumber(car.price_raw ?? car.price);
    const mileage = toNumber(car.mileage);
    const normalized = Math.min(Math.max(mileage, 0), maxKm) / maxKm;
    const weight = Math.max(0.2, 1 - normalized);
    weightedSum += price * weight;
    weightTotal += weight;
  });
  return weightTotal ? weightedSum / weightTotal : 0;
};

export const getBellCurveRating = (price: number, cars: CarRecord[]) => {
  const prices = cars.map((car) => toNumber(car.price_raw ?? car.price)).filter((value) => value > 0);
  if (prices.length === 0) return 'Fair';
  const mean = prices.reduce((sum, value) => sum + value, 0) / prices.length;
  const variance =
    prices.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / prices.length;
  const std = Math.sqrt(variance);
  if (!std) return price <= mean ? 'Good Purchase' : 'Bad Deal';
  const z = (price - mean) / std;
  if (z <= -0.5) return 'Good Purchase';
  if (z >= 0.5) return 'Bad Deal';
  return 'Fair';
};
