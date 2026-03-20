import { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineController,
  ScatterController,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { CheckCircle2 } from 'lucide-react';
import { sampleCars, type CarRecord } from '../data/sampleCars';
import { buildStats, formatCurrency, formatNumber, getBellCurveRating, weightedAveragePriceByMileage } from '../utils/carAnalytics';
import { supabase } from '../lib/supabaseClient';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineController,
  ScatterController,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
);

type Filters = {
  make: string;
  model: string;
  manufactured: string;
  imported: string;
};

const isSupabaseReady = () => Boolean(supabase);

const unique = (values: Array<string | number | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string | number => value !== null && value !== undefined)))
    .map(String)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const uniqueNormalized = (values: Array<string | number | null | undefined>) => {
  const map = new Map<string, string>();
  values.forEach((value) => {
    if (value === null || value === undefined) return;
    const raw = String(value).trim();
    if (!raw) return;
    const key = raw.toLowerCase();
    if (!map.has(key)) {
      map.set(key, raw);
    }
  });
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};

const CarEstimator = () => {
  const [filters, setFilters] = useState<Filters>({
    make: '',
    model: '',
    manufactured: '',
    imported: '',
  });
  const [results, setResults] = useState<CarRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [makeOptions, setMakeOptions] = useState<string[]>([]);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [manufacturedOptions, setManufacturedOptions] = useState<string[]>([]);
  const [importedOptions, setImportedOptions] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [currentPrice, setCurrentPrice] = useState<string>('');
  const [hasEstimated, setHasEstimated] = useState<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [dataSource, setDataSource] = useState<'supabase' | 'sample'>('sample');
  const [errorMessage, setErrorMessage] = useState('');

  const makes = useMemo(
    () => (makeOptions.length ? makeOptions : uniqueNormalized(sampleCars.map((car) => car.make))),
    [makeOptions],
  );
  const models = useMemo(
    () => (modelOptions.length ? modelOptions : uniqueNormalized(sampleCars.map((car) => car.model))),
    [modelOptions],
  );
  const manufacturedYears = useMemo(
    () => (manufacturedOptions.length ? manufacturedOptions : unique(sampleCars.map((car) => car.manufactured))),
    [manufacturedOptions],
  );
  const importedYears = useMemo(
    () => (importedOptions.length ? importedOptions : unique(sampleCars.map((car) => car.imported))),
    [importedOptions],
  );

  useEffect(() => {
    const loadMakes = async () => {
      if (!supabase) {
        setMakeOptions(uniqueNormalized(sampleCars.map((car) => car.make)));
        setTotalCount(sampleCars.length);
        return;
      }

      const { data, error } = await supabase.from('car').select('make');
      const countResult = await supabase.from('car').select('*', { count: 'exact', head: true });

      if (error || !data) {
        setMakeOptions(uniqueNormalized(sampleCars.map((car) => car.make)));
        setTotalCount(sampleCars.length);
        return;
      }

      if (countResult.error || countResult.count === null) {
        setTotalCount(0);
      } else {
        setTotalCount(countResult.count);
      }

      setMakeOptions(uniqueNormalized(data.map((row) => row.make)));
    };

    loadMakes();
  }, []);

  useEffect(() => {
    const loadModels = async () => {
      if (!filters.make) {
        setModelOptions([]);
        return;
      }

      if (!supabase) {
        const modelsForMake = sampleCars
          .filter((car) => car.make === filters.make)
          .map((car) => car.model);
        setModelOptions(uniqueNormalized(modelsForMake));
        return;
      }

      const { data, error } = await supabase.from('car').select('model').eq('make', filters.make);
      if (error || !data) {
        setModelOptions([]);
        return;
      }

      setModelOptions(uniqueNormalized(data.map((row) => row.model)));
    };

    loadModels();
  }, [filters.make]);

  useEffect(() => {
    const loadYears = async () => {
      if (!filters.make || !filters.model) {
        setManufacturedOptions([]);
        setImportedOptions([]);
        return;
      }

      if (!supabase) {
        const filtered = sampleCars.filter(
          (car) => car.make === filters.make && car.model === filters.model,
        );
        setManufacturedOptions(unique(filtered.map((car) => car.manufactured)));
        setImportedOptions(unique(filtered.map((car) => car.imported)));
        return;
      }

      const { data, error } = await supabase
        .from('car')
        .select('manufactured, imported')
        .eq('make', filters.make)
        .eq('model', filters.model);

      if (error || !data) {
        setManufacturedOptions([]);
        setImportedOptions([]);
        return;
      }

      setManufacturedOptions(unique(data.map((row) => row.manufactured)));
      setImportedOptions(unique(data.map((row) => row.imported)));
    };

    loadYears();
  }, [filters.make, filters.model]);

  const similarListings = useMemo(() => {
    if (!results.length) return [];
    return results.filter((car) => {
      return (
        (!filters.make || car.make === filters.make) &&
        (!filters.model || car.model === filters.model) &&
        (!filters.manufactured || String(car.manufactured) === filters.manufactured)
      );
    });
  }, [results, filters]);

  const pageSize = 9;
  const totalPages = Math.max(1, Math.ceil(similarListings.length / pageSize));
  const pagedListings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return similarListings.slice(start, start + pageSize);
  }, [similarListings, currentPage]);

  const importedMatches = useMemo(() => {
    if (!filters.imported) return similarListings;
    return similarListings.filter((car) => String(car.imported) === filters.imported);
  }, [similarListings, filters.imported]);

  const statsAll = useMemo(() => buildStats(similarListings), [similarListings]);
  const statsImported = useMemo(() => buildStats(importedMatches), [importedMatches]);

  const pricingPool = filters.imported ? importedMatches : similarListings;
  const mileageWeightedEstimate = weightedAveragePriceByMileage(pricingPool);

  const rangeMin = statsAll.price.min;
  const rangeMax = statsAll.price.max;
  const currentValue = Number(currentPrice.replace(/[^\d.-]/g, ''));
  const currentDeal = currentValue > 0 ? getBellCurveRating(currentValue, similarListings) : null;
  const currentTone =
    currentDeal === 'Good Purchase'
      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100'
      : currentDeal === 'Bad Deal'
        ? 'bg-rose-500/20 border-rose-400/40 text-rose-100'
        : 'bg-amber-500/20 border-amber-400/40 text-amber-100';

  const formatPriceInput = (value: string) => {
    const numeric = value.replace(/[^\d]/g, '');
    if (!numeric) return '';
    return formatNumber(Number(numeric));
  };

  const handlePriceInput = (value: string) => {
    setCurrentPrice(formatPriceInput(value));
  };

  const chartData = useMemo(() => {
    const binSize = 25000;
    const maxKm = 300000;
    const bins = Math.floor(maxKm / binSize);
    const counts = new Array(bins).fill(0);

    similarListings.forEach((car) => {
      const mileage = typeof car.mileage === 'number' ? car.mileage : 0;
      if (mileage <= 0) return;
      const clamped = Math.min(mileage, maxKm);
      const index = Math.min(Math.floor(clamped / binSize), bins - 1);
      counts[index] += 1;
    });

    const labels = counts.map((_, index) => {
      const start = index * binSize;
      const end = start + binSize;
      return `${formatNumber(start)}-${formatNumber(end)} км`;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Зарууд',
          data: counts,
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderRadius: 6,
        },
      ],
    };
  }, [similarListings]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context: { dataset: { label: string }; parsed: { y: number } }) => {
              const label = context.dataset.label;
              return `${label}: ${formatNumber(context.parsed.y)} зар`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#bfdbfe',
          },
          grid: { color: 'rgba(59, 130, 246, 0.15)' },
          title: {
            display: true,
            text: 'Гүйлтийн хүрээ (км)',
            color: '#bfdbfe',
          },
        },
        y: {
          position: 'left' as const,
          ticks: {
            color: '#bfdbfe',
          },
          grid: { color: 'rgba(59, 130, 246, 0.15)' },
          title: {
            display: true,
            text: 'Зарын тоо',
            color: '#bfdbfe',
          },
        },
      },
    };
  }, []);

  const priceChart = useMemo(() => {
    const prices = similarListings
      .map((car) => (typeof car.price_raw === 'number' ? car.price_raw : 0))
      .filter((value) => value > 0);
    if (!prices.length) {
      return {
        data: { datasets: [] as Array<unknown> },
        options: {},
        plugin: null as null | ((chart: unknown) => void),
      };
    }

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = Math.max(1, max - min);
    const mean = statsAll.price.average;
    const variance =
      prices.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / prices.length;
    const std = Math.sqrt(variance) || 1;
    const goodLow = mean * (1 - 0.341);
    const goodHigh = mean * (1 + 0.341);

    const points = 40;
    const step = range / points;
    const linePoints = Array.from({ length: points + 1 }, (_, i) => {
      const x = min + step * i;
      const z = (x - mean) / std;
      const y = Math.exp(-0.5 * z * z);
      return { x, y };
    });
    const maxY = Math.max(...linePoints.map((p) => p.y));
    const scaledLine = linePoints.map((p) => ({ x: p.x, y: (p.y / maxY) * prices.length }));
    const maxCount = prices.length;

    const goodZonePlugin = {
      id: 'goodZone',
      beforeDatasetsDraw: (chart: { ctx: CanvasRenderingContext2D; chartArea: { top: number; bottom: number }; scales: { x: { getPixelForValue: (value: number) => number } } }) => {
        const { ctx, chartArea, scales } = chart;
        const xStart = scales.x.getPixelForValue(goodLow);
        const xEnd = scales.x.getPixelForValue(goodHigh);
        ctx.save();
        ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
        ctx.fillRect(xStart, chartArea.top, xEnd - xStart, chartArea.bottom - chartArea.top);
        ctx.restore();
      },
    };

    return {
      data: {
        datasets: [
          {
            type: 'line' as const,
            label: 'Тархалт',
            data: scaledLine,
            borderColor: 'rgba(191, 219, 254, 0.9)',
            backgroundColor: 'rgba(191, 219, 254, 0.3)',
            tension: 0.35,
            pointRadius: 0,
            order: 1,
          },
          {
            type: 'line' as const,
            label: 'Median',
            data: [
              { x: statsAll.price.median, y: 0 },
              { x: statsAll.price.median, y: maxCount },
            ],
            borderColor: 'rgba(34, 211, 238, 0.9)',
            borderWidth: 2,
            pointRadius: 0,
          },
          {
            type: 'line' as const,
            label: 'Average',
            data: [
              { x: statsAll.price.average, y: 0 },
              { x: statsAll.price.average, y: maxCount },
            ],
            borderColor: 'rgba(251, 191, 36, 0.9)',
            borderWidth: 2,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: { dataset: { label: string }; parsed: { x: number; y: number } }) => {
                const label = context.dataset.label;
                if (label === 'Тархалт') {
                  return `${label}: ${formatNumber(context.parsed.y)} зар @ ${formatCurrency(context.parsed.x)}`;
                }
                return `${label}: ${formatCurrency(context.parsed.x)}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'linear' as const,
            ticks: {
              color: '#bfdbfe',
              callback: (value: number | string) => formatCurrency(Number(value)),
            },
            grid: { color: 'rgba(59, 130, 246, 0.15)' },
            title: {
              display: true,
              text: 'Үнэ (₮)',
              color: '#bfdbfe',
            },
          },
          y: {
            ticks: {
              color: '#bfdbfe',
            },
            grid: { color: 'rgba(59, 130, 246, 0.15)' },
            title: {
              display: true,
              text: 'Зарын тоо',
              color: '#bfdbfe',
            },
          },
        },
      },
      plugin: goodZonePlugin,
    };
  }, [similarListings, statsAll.price.average, statsAll.price.median]);

  const importPriceChart = useMemo(() => {
    const points = similarListings
      .filter((car) => typeof car.imported === 'number' && car.price_raw > 0)
      .map((car) => ({ x: car.imported as number, y: car.price_raw }));

    if (points.length === 0) {
      return { data: { datasets: [] as Array<unknown> }, options: {} };
    }

    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);
    const denom = n * sumX2 - sumX * sumX;
    const slope = denom ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = n ? (sumY - slope * sumX) / n : 0;
    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const trend = [
      { x: minX, y: slope * minX + intercept },
      { x: maxX, y: slope * maxX + intercept },
    ];

    return {
      data: {
        datasets: [
          {
            type: 'scatter' as const,
            label: 'Зарууд',
            data: points,
            backgroundColor: 'rgba(56, 189, 248, 0.7)',
          },
          {
            type: 'line' as const,
            label: 'Чиг хандлага',
            data: trend,
            borderColor: 'rgba(16, 185, 129, 0.9)',
            borderWidth: 2,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: { dataset: { label: string }; parsed: { x: number; y: number } }) => {
                const label = context.dataset.label;
                return `${label}: ${context.parsed.x} → ${formatCurrency(context.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'linear' as const,
            min: minX,
            max: maxX,
            ticks: {
              color: '#bfdbfe',
              stepSize: 1,
              callback: (value: number | string) => String(Math.round(Number(value))),
            },
            grid: { color: 'rgba(59, 130, 246, 0.15)' },
            title: { display: true, text: 'Импортолсон он', color: '#bfdbfe' },
          },
          y: {
            ticks: {
              color: '#bfdbfe',
              callback: (value: number | string) => formatCurrency(Number(value)),
            },
            grid: { color: 'rgba(59, 130, 246, 0.15)' },
            title: { display: true, text: 'Үнэ (₮)', color: '#bfdbfe' },
          },
        },
      },
    };
  }, [similarListings]);

  const mileagePriceChart = useMemo(() => {
    const points = similarListings
      .filter((car) => typeof car.mileage === 'number' && car.mileage > 0 && car.price_raw > 0)
      .map((car) => ({ x: car.mileage as number, y: car.price_raw }));

    if (points.length === 0) {
      return { data: { datasets: [] as Array<unknown> }, options: {} };
    }

    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);
    const denom = n * sumX2 - sumX * sumX;
    const slope = denom ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = n ? (sumY - slope * sumX) / n : 0;
    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const trend = [
      { x: minX, y: slope * minX + intercept },
      { x: maxX, y: slope * maxX + intercept },
    ];

    return {
      data: {
        datasets: [
          {
            type: 'scatter' as const,
            label: 'Зарууд',
            data: points,
            backgroundColor: 'rgba(129, 140, 248, 0.7)',
          },
          {
            type: 'line' as const,
            label: 'Чиг хандлага',
            data: trend,
            borderColor: 'rgba(14, 116, 144, 0.9)',
            borderWidth: 2,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: { dataset: { label: string }; parsed: { x: number; y: number } }) => {
                const label = context.dataset.label;
                return `${label}: ${formatNumber(context.parsed.x)} км → ${formatCurrency(context.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'linear' as const,
            min: 0,
            max: 300000,
            ticks: {
              color: '#bfdbfe',
              stepSize: 50000,
              callback: (value: number | string) => `${formatNumber(Number(value))} км`,
            },
            grid: { color: 'rgba(59, 130, 246, 0.15)' },
            title: { display: true, text: 'Гүйлт (км)', color: '#bfdbfe' },
          },
          y: {
            ticks: {
              color: '#bfdbfe',
              callback: (value: number | string) => formatCurrency(Number(value)),
            },
            grid: { color: 'rgba(59, 130, 246, 0.15)' },
            title: { display: true, text: 'Үнэ (₮)', color: '#bfdbfe' },
          },
        },
      },
    };
  }, [similarListings]);

  const handleChange = (field: keyof Filters, value: string) => {
    setFilters((prev) => {
      if (field === 'make') {
        return { make: value, model: '', manufactured: '', imported: '' };
      }
      if (field === 'model') {
        return { ...prev, model: value, manufactured: '', imported: '' };
      }
      if (field === 'manufactured') {
        return { ...prev, manufactured: value, imported: '' };
      }
      return { ...prev, [field]: value };
    });
    setCurrentPage(1);
    setHasEstimated(false);
  };

  const handleEstimate = async () => {
    setStatus('loading');
    setErrorMessage('');

    try {
      if (!isSupabaseReady()) {
        throw new Error('Supabase env not configured');
      }

      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      let query = supabase.from('car').select('*');
      if (filters.make) query = query.eq('make', filters.make);
      if (filters.model) query = query.eq('model', filters.model);
      if (filters.manufactured) query = query.eq('manufactured', Number(filters.manufactured));

      const { data, error } = await query;
      if (error) throw error;

      setResults(data ?? []);
      setStatus('ready');
      setDataSource('supabase');
      setCurrentPage(1);
      setHasEstimated(true);
    } catch (error) {
      const fallback = sampleCars.filter((car) => {
        return (
          (!filters.make || car.make === filters.make) &&
          (!filters.model || car.model === filters.model) &&
          (!filters.manufactured || String(car.manufactured) === filters.manufactured)
        );
      });
      setResults(fallback);
      setStatus('ready');
      setDataSource('sample');
      setErrorMessage('Supabase unavailable. Showing sample data.');
      setCurrentPage(1);
      setHasEstimated(true);
    }
  };

  return (
    <main className="bg-blue-950 text-white">
      <section id="home" className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 w-full h-full">
          <iframe
            src="https://my.spline.design/claritystream-hyuvumQA1HlxLUt8VtkgRodP/"
            frameBorder="0"
            width="100%"
            height="100%"
            style={{ pointerEvents: 'none' }}
            title="Spline дэвсгэр"
          />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_55%)]" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-blue-900/40 to-transparent" />

        <div className="container mx-auto px-4 md:px-6 lg:px-8 pt-44 pb-16 relative z-10">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-start">
            <div className="space-y-6">
              <div className="flex items-center space-x-3">
                <div className="h-1 w-12 bg-blue-500" />
                <p className="text-blue-200 font-medium">Импортын автомашины ухаалаг шинжилгээ</p>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                Импортын аль ч зарын зах зээлийн үнийг хэдхэн минутад тооцоол.
              </h1>
              <p className="text-lg text-blue-100">
                Үйлдвэрлэгч, загвар, он зэргийг сонгоод таны өгөгдөл дээр суурилсан үнэ, гүйлтийн тархалт,
                зах зээлийн үнэлгээг хараарай. Ижил заруудыг гаргаж, зах зээлийн тоймыг ойлгомжтойгоор харуулна.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                <div className="rounded-xl border border-blue-800/60 bg-blue-900/50 p-4">
                  <div className="text-xs uppercase tracking-wide text-blue-200">Нийт бүртгэл</div>
                  <div className="text-2xl font-semibold">{totalCount || 9388}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 border border-blue-800/60 p-6 shadow-xl backdrop-blur">
              <h2 className="text-xl font-semibold mb-4">Импортын үнийг тооцоол</h2>
              <div className="grid gap-4">
                <label className="text-sm text-blue-100">
                  Үйлдвэрлэгч
                  <select
                    className="mt-2 w-full rounded-lg bg-blue-950/70 border border-blue-800/60 px-3 py-2 text-white"
                    value={filters.make}
                    onChange={(event) => handleChange('make', event.target.value)}
                  >
                    <option value="">Үйлдвэрлэгч сонгох</option>
                    {makes.map((make) => (
                      <option key={make} value={make}>
                        {make}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-blue-100">
                  Загвар
                  <select
                    className="mt-2 w-full rounded-lg bg-blue-950/70 border border-blue-800/60 px-3 py-2 text-white"
                    value={filters.model}
                    onChange={(event) => handleChange('model', event.target.value)}
                  >
                    <option value="">Загвар сонгох</option>
                    {models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm text-blue-100">
                    Үйлдвэрлэсэн он
                    <select
                      className="mt-2 w-full rounded-lg bg-blue-950/70 border border-blue-800/60 px-3 py-2 text-white"
                      value={filters.manufactured}
                      onChange={(event) => handleChange('manufactured', event.target.value)}
                    >
                      <option value="">Хамаагүй</option>
                      {manufacturedYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-blue-100">
                    Импортолсон он
                    <select
                      className="mt-2 w-full rounded-lg bg-blue-950/70 border border-blue-800/60 px-3 py-2 text-white"
                      value={filters.imported}
                      onChange={(event) => handleChange('imported', event.target.value)}
                    >
                      <option value="">Хамаагүй</option>
                      {importedYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="text-sm text-blue-100">
                  Таны санал болгож буй үнэ (заавал биш)
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="жишээ нь 28,500,000"
                    value={currentPrice}
                    onChange={(event) => handlePriceInput(event.target.value)}
                    className="mt-2 w-full rounded-lg bg-blue-950/70 border border-blue-800/60 px-3 py-2 text-white"
                  />
                </label>
                <button
                  onClick={handleEstimate}
                  className="mt-2 w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 transition-colors"
                >
                  {status === 'loading' ? 'Тооцоолж байна...' : 'Тооцоо хийх'}
                </button>
                {errorMessage && (
                  <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-400/40 rounded-lg px-3 py-2">
                    {errorMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="report" className="py-16 bg-blue-950">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          {hasEstimated && currentDeal && (
            <div
              className={`mb-8 rounded-2xl border px-6 py-6 text-center shadow-xl ${currentTone} ${
                currentDeal === 'Good Purchase'
                  ? 'bg-gradient-to-r from-emerald-500/30 via-emerald-400/20 to-blue-900/30'
                  : currentDeal === 'Bad Deal'
                    ? 'bg-gradient-to-r from-rose-500/30 via-rose-400/20 to-blue-900/30'
                    : 'bg-gradient-to-r from-amber-500/30 via-amber-400/20 to-blue-900/30'
              }`}
            >
              <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.3em] text-blue-100/70">
                <CheckCircle2 className="h-4 w-4" />
                Үнийн дохио
              </div>
              <div className="mt-3 text-3xl font-bold">
                {currentDeal === 'Good Purchase'
                  ? 'Сайн санал'
                  : currentDeal === 'Bad Deal'
                    ? 'Муу санал'
                    : 'Дундаж санал'}
              </div>
              <div className="mt-2 text-sm text-blue-100">
                {currentDeal === 'Good Purchase'
                  ? 'Зах зээлийн муруйгаас доогуур үнэ — үнэ цэнтэй санал.'
                  : currentDeal === 'Bad Deal'
                    ? 'Зах зээлийн муруйгаас дээгүүр үнэ — тохиролцох эсвэл алгас.'
                    : 'Зах зээлийн муруйтай нийцсэн — боломжийн үнэ.'}
              </div>
            </div>
          )}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
            <div>
              <p className="text-blue-200 uppercase tracking-wide text-sm">Зах зээлийн тайлан</p>
              <h2 className="text-3xl font-semibold">Үнэ ба гүйлтийн тархалт</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-blue-800/60 bg-blue-900/50 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-blue-200">Гүйлтээр жинлэсэн тооцоо</div>
                <div className="text-xl font-semibold">{formatCurrency(mileageWeightedEstimate || 0)}</div>
                <div className="text-xs text-blue-200 mt-1">Импортын он + гүйлтийн жинг ашиглав</div>
              </div>
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-emerald-200">Үнийн хүрээ</div>
                <div className="text-lg font-semibold text-emerald-100">
                  {formatCurrency(rangeMin)} - {formatCurrency(rangeMax)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-blue-800/60 bg-blue-900/30 p-6">
              <div className="text-xs uppercase tracking-wide text-blue-200 mb-3">Гүйлтийн тархалт</div>
              <div className="h-[320px]">
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>
            <div className="rounded-2xl border border-blue-800/60 bg-blue-900/30 p-6">
              <div className="text-xs uppercase tracking-wide text-blue-200 mb-3">Үнийн тархалт</div>
              <div className="h-[320px]">
                <Bar data={priceChart.data} options={priceChart.options} plugins={priceChart.plugin ? [priceChart.plugin] : []} />
              </div>
            </div>
          </div>

          <div className="mt-8 grid lg:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-blue-800/60 bg-blue-900/30 p-6">
              <div className="text-xs uppercase tracking-wide text-blue-200 mb-3">Импортын он ба үнэ</div>
              <div className="h-[320px]">
                <Bar data={importPriceChart.data} options={importPriceChart.options} />
              </div>
            </div>
            <div className="rounded-2xl border border-blue-800/60 bg-blue-900/30 p-6">
              <div className="text-xs uppercase tracking-wide text-blue-200 mb-3">Гүйлт ба үнэ</div>
              <div className="h-[320px]">
                <Bar data={mileagePriceChart.data} options={mileagePriceChart.options} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="listings" className="py-16 bg-gradient-to-b from-blue-950 via-blue-950 to-blue-900/40">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-blue-200 uppercase tracking-wide text-sm">Ижил зарууд</p>
              <h2 className="text-3xl font-semibold">Ижил төстэй зарууд</h2>
            </div>
            <div className="text-sm text-blue-200">{similarListings.length} үр дүн</div>
          </div>

          {similarListings.length === 0 ? (
            <div className="rounded-2xl border border-blue-800/60 bg-blue-900/30 p-8 text-blue-100">
              Ижил заруудыг харахын тулд тооцоо хийнэ үү.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pagedListings.map((car) => {
                return (
                  <div
                    key={car.id}
                    className="rounded-2xl border border-blue-800/60 bg-blue-900/40 p-5 flex flex-col gap-4"
                  >
                    <div>
                      <p className="text-sm text-blue-200">{car.location || 'Байршилгүй'}</p>
                      <h3 className="text-lg font-semibold">{car.title || `${car.make} ${car.model}`}</h3>
                      <p className="text-sm text-blue-200">
                        {car.manufactured || '—'} үйлдвэрлэсэн он · Импорт {car.imported || '—'}
                      </p>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <div className="text-2xl font-semibold">{formatCurrency(car.price_raw)}</div>
                      <span className="text-sm text-blue-200">{formatNumber(car.mileage || 0)} км</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-blue-100">
                      <span className="rounded-full bg-blue-800/60 px-3 py-1">{car.engine || 'Хөдөлгүүр тодорхойгүй'}</span>
                      <span className="rounded-full bg-blue-800/60 px-3 py-1">{car.fuel || 'Түлш тодорхойгүй'}</span>
                      <span className="rounded-full bg-blue-800/60 px-3 py-1">{car.type || 'Төрөл тодорхойгүй'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {similarListings.length > pageSize && (
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <button
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg border border-blue-800/60 bg-blue-900/40 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Өмнөх
              </button>
              <div className="text-sm text-blue-200">
                Хуудас {currentPage} / {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg border border-blue-800/60 bg-blue-900/40 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Дараах
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default CarEstimator;
