import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type DimensionValue,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Invoice } from '../types';
import { getInvoicesByDateRangeFromDB, getInvoicesFromDB } from '../services/db';
import { generateExcelReport } from '../services/excelService';
import { colors, fontFamily, radius, typography } from '../theme/tokens';
import { formatHoChiMinhDateKey } from '../utils/hoChiMinhTime';

type ReportTab = 'statistics' | 'invoices';
type ReportRange = 'today' | 'week' | 'month';
type ExportMode = 'day' | 'month';
type ExportDayField = 'start' | 'end' | null;
type ChartRangeAnchor = {
  top: number;
  right: number;
};
type InvoiceDateGroup = {
  dateKey: string;
  label: string;
  invoices: Invoice[];
};
type RevenueChartBar = {
  label: string;
  amount: number;
  value: string;
  height: DimensionValue;
  isCurrent: boolean;
};
type RevenueSummary = {
  currentAmount: number;
  cashAmount: number;
  transferAmount: number;
  trendText: string;
  trendIcon: 'trending-up' | 'trending-down' | 'trending-flat';
  trendColor: string;
};

const REPORT_RANGES: Record<ReportRange, string> = {
  today: 'Hôm nay',
  week: 'Tuần này',
  month: 'Tháng này',
};

const CHART_RANGE_OPTIONS: { value: ReportRange; label: string }[] = [
  { value: 'today', label: 'Theo ngày' },
  { value: 'week', label: 'Theo tuần' },
  { value: 'month', label: 'Theo tháng' },
];

const CHART_RANGE_DROPDOWN_WIDTH = 150;
const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const formatCompactMoney = (value: number) =>
  `${Math.round(value).toLocaleString('vi-VN')}đ`;

const formatDisplayMoney = (value: number) =>
  `${Math.round(value).toLocaleString('vi-VN')} ₫`;

const formatDateKeyForDisplay = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
};

const parseDateKeyAsUTCDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatUTCDateKey = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatUTCDateForDisplay = (date: Date) => {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

const formatUTCDateForChartLabel = (date: Date) => {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${month}/${day}`;
};

const addUTCDateDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * MS_PER_DAY);

const dateKeyToPickerDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

const pickerDateToDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getInvoiceDateKey = (createdAt?: string) => {
  const match = createdAt?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
};

const invoiceHasWarning = (invoice: Invoice) =>
  invoice.items.some((item) => {
    const confidence = (item as Invoice['items'][number] & { confidence?: number }).confidence;
    return typeof confidence === 'number' && confidence < 0.8;
  });

const groupInvoicesByDate = (invoices: Invoice[], todayKey: string): InvoiceDateGroup[] => {
  const sortedInvoices = [...invoices].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const groups = new Map<string, Invoice[]>();

  sortedInvoices.forEach((invoice) => {
    const dateKey = getInvoiceDateKey(invoice.created_at) ?? 'unknown';
    const items = groups.get(dateKey) ?? [];
    items.push(invoice);
    groups.set(dateKey, items);
  });

  return Array.from(groups.entries()).map(([dateKey, groupInvoices]) => ({
    dateKey,
    label:
      dateKey === todayKey
        ? 'HÔM NAY'
        : dateKey === 'unknown'
          ? 'Không rõ ngày'
          : formatDateKeyForDisplay(dateKey),
    invoices: groupInvoices,
  }));
};

const getStartOfWeekUTCDate = (date: Date) => {
  const weekday = date.getUTCDay();
  const mondayOffset = weekday === 0 ? 6 : weekday - 1;
  return addUTCDateDays(date, -mondayOffset);
};

const sumInvoicesBetweenDateKeys = (invoices: Invoice[], startDateKey: string, endDateKey: string) =>
  invoices.reduce((sum, invoice) => {
    const invoiceDateKey = getInvoiceDateKey(invoice.created_at);
    if (!invoiceDateKey || invoiceDateKey < startDateKey || invoiceDateKey > endDateKey) {
      return sum;
    }
    return sum + invoice.final_amount;
  }, 0);

const sumInvoicesByExactDateKey = (invoices: Invoice[], dateKey: string) =>
  sumInvoicesBetweenDateKeys(invoices, dateKey, dateKey);

const sumInvoicesByMonth = (invoices: Invoice[], year: number, month: number) => {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  return invoices.reduce((sum, invoice) => {
    const invoiceDateKey = getInvoiceDateKey(invoice.created_at);
    return invoiceDateKey?.startsWith(monthKey) ? sum + invoice.final_amount : sum;
  }, 0);
};

const formatGrowthPercent = (currentAmount: number, previousAmount: number) => {
  if (previousAmount === 0) return currentAmount > 0 ? '+100%' : '0%';
  const growth = ((currentAmount - previousAmount) / previousAmount) * 100;
  const rounded = Number(growth.toFixed(1));
  const formatted = Number.isInteger(rounded)
    ? Math.abs(rounded).toLocaleString('vi-VN')
    : Math.abs(rounded).toLocaleString('vi-VN', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
  return `${growth >= 0 ? '+' : '-'}${formatted}%`;
};

const buildRevenueSummary = (
  invoices: Invoice[],
  range: ReportRange,
  todayKey: string
): RevenueSummary => {
  const today = parseDateKeyAsUTCDate(todayKey);
  let comparisonLabel = 'ngày trước';
  // Hàm cộng doanh thu của kỳ hiện tại / kỳ trước, tái sử dụng cho tổng + tiền mặt + chuyển khoản.
  let sumCurrentPeriod: (list: Invoice[]) => number;
  let sumPreviousPeriod: (list: Invoice[]) => number;

  if (range === 'today') {
    const previousDayKey = formatUTCDateKey(addUTCDateDays(today, -1));
    sumCurrentPeriod = (list) => sumInvoicesByExactDateKey(list, todayKey);
    sumPreviousPeriod = (list) => sumInvoicesByExactDateKey(list, previousDayKey);
    comparisonLabel = 'ngày trước';
  } else if (range === 'week') {
    const currentWeekStart = getStartOfWeekUTCDate(today);
    const previousWeekStart = addUTCDateDays(currentWeekStart, -7);
    const previousWeekEnd = addUTCDateDays(currentWeekStart, -1);
    sumCurrentPeriod = (list) =>
      sumInvoicesBetweenDateKeys(list, formatUTCDateKey(currentWeekStart), todayKey);
    sumPreviousPeriod = (list) =>
      sumInvoicesBetweenDateKeys(
        list,
        formatUTCDateKey(previousWeekStart),
        formatUTCDateKey(previousWeekEnd)
      );
    comparisonLabel = 'tuần trước';
  } else {
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth() + 1;
    const previousMonthDate = new Date(Date.UTC(year, month - 2, 1));
    sumCurrentPeriod = (list) => sumInvoicesByMonth(list, year, month);
    sumPreviousPeriod = (list) =>
      sumInvoicesByMonth(
        list,
        previousMonthDate.getUTCFullYear(),
        previousMonthDate.getUTCMonth() + 1
      );
    comparisonLabel = 'tháng trước';
  }

  const cashInvoices = invoices.filter((invoice) => invoice.payment_method === 'tiền mặt');
  const transferInvoices = invoices.filter((invoice) => invoice.payment_method !== 'tiền mặt');

  const currentAmount = sumCurrentPeriod(invoices);
  const previousAmount = sumPreviousPeriod(invoices);
  const cashAmount = sumCurrentPeriod(cashInvoices);
  const transferAmount = sumCurrentPeriod(transferInvoices);

  const trendIcon =
    currentAmount > previousAmount ? 'trending-up' : currentAmount < previousAmount ? 'trending-down' : 'trending-flat';
  const trendColor =
    currentAmount > previousAmount ? colors.tertiary : currentAmount < previousAmount ? colors.errorCrimson : colors.onSurfaceVariant;

  return {
    currentAmount,
    cashAmount,
    transferAmount,
    trendText: `${formatGrowthPercent(currentAmount, previousAmount)} so với ${comparisonLabel}`,
    trendIcon,
    trendColor,
  };
};

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

// Khoảng ngày người dùng tự chọn (từ ngày → đến ngày). Chưa chọn ngày bắt đầu -> null.
const getDayRangePreview = (startKey: string | null, endKey: string) =>
  startKey ? `${formatDateKeyForDisplay(startKey)} - ${formatDateKeyForDisplay(endKey)}` : null;

const getDayPeriodName = (startKey: string, endKey: string) =>
  startKey === endKey
    ? `NGÀY ${formatDateKeyForDisplay(startKey)}`
    : `TỪ ${formatDateKeyForDisplay(startKey)} ĐẾN ${formatDateKeyForDisplay(endKey)}`;

// Khoảng của một tháng trong năm hiện tại. Tháng hiện tại kết thúc ở hôm nay (không lấy tương lai).
const getMonthExportRange = (monthNum: number, todayKey: string) => {
  const [yearText, monthText] = todayKey.split('-');
  const year = Number(yearText);
  const currentMonth = Number(monthText);
  const paddedMonth = String(monthNum).padStart(2, '0');
  const startDateKey = `${yearText}-${paddedMonth}-01`;

  if (monthNum === currentMonth) {
    return {
      startDateKey,
      endDateKey: todayKey,
      preview: `01/${paddedMonth}/${year} - ${formatDateKeyForDisplay(todayKey)}`,
    };
  }

  const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const paddedLastDay = String(lastDay).padStart(2, '0');
  return {
    startDateKey,
    endDateKey: `${yearText}-${paddedMonth}-${paddedLastDay}`,
    preview: `01/${paddedMonth}/${year} - ${paddedLastDay}/${paddedMonth}/${year}`,
  };
};

const getMonthPeriodName = (monthNum: number, yearText: string) => `THÁNG ${monthNum}/${yearText}`;

const formatChartMoney = (value: number) => {
  const rounded = Math.round(value);
  if (rounded >= 1_000_000) {
    return `${Number((rounded / 1_000_000).toFixed(1)).toLocaleString('vi-VN')}tr`;
  }
  if (rounded >= 1_000) {
    return `${Math.round(rounded / 1_000).toLocaleString('vi-VN')}k`;
  }
  return `${rounded.toLocaleString('vi-VN')}đ`;
};

const formatInvoiceTime = (createdAt?: string) => {
  if (!createdAt) return '--:--';
  const timeMatch = createdAt.match(/\b(\d{2}:\d{2})/);
  return timeMatch?.[1] ?? createdAt;
};

const formatInvoiceDetailDateTime = (createdAt?: string) => {
  const dateKey = getInvoiceDateKey(createdAt);
  const time = formatInvoiceTime(createdAt);

  if (!dateKey) {
    return `--/--/---- - ${time}`;
  }

  return `${formatDateKeyForDisplay(dateKey)} - ${time}`;
};

const buildRevenueChartBars = (
  invoices: Invoice[],
  range: ReportRange,
  todayKey: string
): RevenueChartBar[] => {
  const today = parseDateKeyAsUTCDate(todayKey);
  const currentMonth = today.getUTCMonth() + 1;
  const currentWeekStart = getStartOfWeekUTCDate(today);

  const bars =
    range === 'today'
      ? WEEKDAY_LABELS.map((label, index) => {
          const date = addUTCDateDays(currentWeekStart, index);
          const dateKey = formatUTCDateKey(date);
          return {
            label,
            amount: sumInvoicesByExactDateKey(invoices, dateKey),
            isCurrent: dateKey === todayKey,
          };
        })
      : range === 'week'
        ? Array.from({ length: 5 }, (_, index) => {
            const weekStart = addUTCDateDays(currentWeekStart, (index - 4) * 7);
            const weekEnd = addUTCDateDays(weekStart, 6);
            return {
              label: formatUTCDateForChartLabel(weekEnd),
              amount: sumInvoicesBetweenDateKeys(
                invoices,
                formatUTCDateKey(weekStart),
                formatUTCDateKey(weekEnd)
              ),
              isCurrent: index === 4,
            };
          })
        : Array.from({ length: 12 }, (_, index) => {
            const month = index + 1;
            const year = today.getUTCFullYear();
            return {
              label: `T${month}`,
              amount: sumInvoicesByMonth(invoices, year, month),
              isCurrent: month === currentMonth,
            };
          });

  const maxAmount = Math.max(...bars.map((bar) => bar.amount), 0);

  return bars.map((bar) => {
    const height: DimensionValue =
      maxAmount === 0 ? '4%' : `${Math.max(8, (bar.amount / maxAmount) * 100)}%`;
    return {
      ...bar,
      value: formatChartMoney(bar.amount),
      height,
    };
  });
};

const getProductRanking = (invoices: Invoice[]) => {
  const ranking = new Map<string, { name: string; quantity: number; unit: string }>();

  invoices.forEach((invoice) => {
    invoice.items.forEach((item) => {
      const current = ranking.get(item.product_name) ?? {
        name: item.product_name,
        quantity: 0,
        unit: item.unit,
      };
      current.quantity += item.quantity;
      ranking.set(item.product_name, current);
    });
  });

  return Array.from(ranking.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
};

export const InvoiceHistoryScreen: React.FC = () => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 1024; // iPad landscape: bố cục nhiều cột.
  const chartRangeButtonRef = useRef<any>(null);
  const invoiceRangeButtonRef = useRef<any>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>('statistics');
  const [chartRange, setChartRange] = useState<ReportRange>('today');
  const [topProductsRange, setTopProductsRange] = useState<ReportRange>('today');
  const [invoiceRange, setInvoiceRange] = useState<ReportRange>('today');
  const [chartInvoices, setChartInvoices] = useState<Invoice[]>([]);
  const [topProductInvoices, setTopProductInvoices] = useState<Invoice[]>([]);
  const [historyInvoices, setHistoryInvoices] = useState<Invoice[]>([]);
  const [chartRangePickerOpen, setChartRangePickerOpen] = useState(false);
  const [chartRangeAnchor, setChartRangeAnchor] = useState<ChartRangeAnchor>({
    top: 128,
    right: 16,
  });
  const [invoiceRangePickerOpen, setInvoiceRangePickerOpen] = useState(false);
  const [invoiceRangeAnchor, setInvoiceRangeAnchor] = useState<ChartRangeAnchor>({
    top: 164,
    right: 16,
  });
  const [exporting, setExporting] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>('day');
  const [dayStartKey, setDayStartKey] = useState<string | null>(null);
  const [dayEndKey, setDayEndKey] = useState(() => formatHoChiMinhDateKey());
  const [activeDayField, setActiveDayField] = useState<ExportDayField>(null);
  const [selectedMonthNum, setSelectedMonthNum] = useState(() =>
    Number(formatHoChiMinhDateKey().split('-')[1])
  );
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    setChartInvoices(getInvoicesFromDB('all'));
  }, [chartRange]);

  useEffect(() => {
    setTopProductInvoices(getInvoicesFromDB(topProductsRange));
  }, [topProductsRange]);

  useEffect(() => {
    setHistoryInvoices(getInvoicesFromDB(invoiceRange));
  }, [invoiceRange]);

  const todayKey = formatHoChiMinhDateKey();
  const revenueSummary = useMemo(
    () => buildRevenueSummary(chartInvoices, chartRange, todayKey),
    [chartInvoices, chartRange, todayKey]
  );
  const revenueChartBars = useMemo(
    () => buildRevenueChartBars(chartInvoices, chartRange, todayKey),
    [chartInvoices, chartRange, todayKey]
  );
  const topProducts = useMemo(() => getProductRanking(topProductInvoices), [topProductInvoices]);
  const historyInvoiceGroups = useMemo(
    () => groupInvoicesByDate(historyInvoices, todayKey),
    [historyInvoices, todayKey]
  );

  // Tablet (master-detail): mặc định chọn hóa đơn đầu tiên để panel phải không trống.
  useEffect(() => {
    if (!isTablet || activeTab !== 'invoices') return;
    const stillExists =
      selectedInvoice != null && historyInvoices.some((inv) => inv.id === selectedInvoice.id);
    if (!stillExists) {
      setSelectedInvoice(historyInvoiceGroups[0]?.invoices[0] ?? null);
    }
  }, [isTablet, activeTab, historyInvoices, historyInvoiceGroups, selectedInvoice]);

  const exportYear = todayKey.split('-')[0];
  const currentMonthNum = Number(todayKey.split('-')[1]);
  const monthExportRange = useMemo(
    () => getMonthExportRange(selectedMonthNum, todayKey),
    [selectedMonthNum, todayKey]
  );
  const maxExportDate = useMemo(() => dateKeyToPickerDate(todayKey), [todayKey]);
  const dayStartDate = useMemo(
    () => (dayStartKey ? dateKeyToPickerDate(dayStartKey) : undefined),
    [dayStartKey]
  );
  const dayEndDate = useMemo(() => dateKeyToPickerDate(dayEndKey), [dayEndKey]);
  const exportRangePreview =
    exportMode === 'day' ? getDayRangePreview(dayStartKey, dayEndKey) : monthExportRange.preview;
  const canExport = exportMode === 'month' || (exportMode === 'day' && !!dayStartKey);

  const handleConfirmExport = async () => {
    let startDateKey: string;
    let endDateKey: string;
    let periodName: string;

    if (exportMode === 'day') {
      if (!dayStartKey) return;
      startDateKey = dayStartKey;
      endDateKey = dayEndKey;
      periodName = getDayPeriodName(dayStartKey, dayEndKey);
    } else {
      startDateKey = monthExportRange.startDateKey;
      endDateKey = monthExportRange.endDateKey;
      periodName = getMonthPeriodName(selectedMonthNum, exportYear);
    }

    setExporting(true);
    try {
      await generateExcelReport(
        getInvoicesByDateRangeFromDB(startDateKey, endDateKey),
        periodName
      );
      setExportVisible(false);
    } catch (err) {
      console.error('Failed to export Excel:', err);
    } finally {
      setExporting(false);
    }
  };

  const openExportModal = () => {
    // Mở modal luôn reset về mặc định: xuất theo ngày, chưa chọn ngày bắt đầu,
    // ngày kết thúc là hôm nay, tháng mặc định là tháng hiện tại.
    setExportMode('day');
    setDayStartKey(null);
    setDayEndKey(todayKey);
    setActiveDayField(null);
    setSelectedMonthNum(currentMonthNum);
    setChartRangePickerOpen(false);
    setExportVisible(true);
  };

  const handleChangeChartRange = (range: ReportRange) => {
    setChartRange(range);
    setChartRangePickerOpen(false);
  };

  const handleChangeInvoiceRange = (range: ReportRange) => {
    setInvoiceRange(range);
    setInvoiceRangePickerOpen(false);
  };

  const openChartRangeDropdown = () => {
    setChartRangePickerOpen(true);

    const node = chartRangeButtonRef.current;
    if (!node?.measureInWindow) {
      return;
    }

    node.measureInWindow((x: number, y: number, width: number, height: number) => {
      const screenWidth = Dimensions.get('window').width;
      setChartRangeAnchor({
        top: y + height + 8,
        right: Math.max(16, screenWidth - x - width),
      });
    });
  };

  const toggleChartRangeDropdown = () => {
    if (chartRangePickerOpen) {
      setChartRangePickerOpen(false);
      return;
    }

    openChartRangeDropdown();
  };

  const openInvoiceRangeDropdown = () => {
    setInvoiceRangePickerOpen(true);

    const node = invoiceRangeButtonRef.current;
    if (!node?.measureInWindow) {
      return;
    }

    node.measureInWindow((x: number, y: number, width: number, height: number) => {
      const screenWidth = Dimensions.get('window').width;
      setInvoiceRangeAnchor({
        top: y + height + 8,
        right: Math.max(16, screenWidth - x - width),
      });
    });
  };

  const toggleInvoiceRangeDropdown = () => {
    if (invoiceRangePickerOpen) {
      setInvoiceRangePickerOpen(false);
      return;
    }

    openInvoiceRangeDropdown();
  };

  const handleChangeExportMode = (mode: ExportMode) => {
    setExportMode(mode);
    setActiveDayField(null);
    // Khi chuyển sang xuất theo tháng, mặc định chọn tháng hiện tại.
    if (mode === 'month') setSelectedMonthNum(currentMonthNum);
  };

  const handleChangeDayDate =
    (field: 'start' | 'end') => (_event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS !== 'ios') setActiveDayField(null);
      if (!date) return;

      const key = pickerDateToDateKey(date);
      if (field === 'start') {
        setDayStartKey(key);
        // Ngày bắt đầu không được vượt quá ngày kết thúc.
        setDayEndKey((prev) => (key > prev ? key : prev));
      } else {
        setDayEndKey(key);
        // Nếu ngày kết thúc lùi trước ngày bắt đầu đã chọn thì bỏ chọn ngày bắt đầu.
        setDayStartKey((prev) => (prev && prev > key ? null : prev));
      }

      if (Platform.OS === 'ios') setActiveDayField(null);
    };

  const openDayPicker = (field: 'start' | 'end') => {
    if (Platform.OS === 'ios') {
      setActiveDayField((prev) => (prev === field ? null : field));
      return;
    }

    DateTimePickerAndroid.open({
      value: (field === 'start' ? dayStartDate : dayEndDate) ?? dayEndDate,
      mode: 'date',
      display: 'default',
      maximumDate: field === 'start' ? dayEndDate : maxExportDate,
      minimumDate: field === 'end' ? dayStartDate : undefined,
      onChange: handleChangeDayDate(field),
    });
  };

  const renderSegmentedTabs = () => (
    <View style={styles.tabsOuter}>
      <View style={styles.tabsInner}>
        <TouchableOpacity
          testID="report-tab-statistics"
          style={[styles.segmentTab, activeTab === 'statistics' && styles.segmentTabActive]}
          activeOpacity={0.9}
          onPress={() => setActiveTab('statistics')}
        >
          <Text style={[styles.segmentText, activeTab === 'statistics' && styles.segmentTextActive]}>
            Thống kê
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="report-tab-invoices"
          style={[styles.segmentTab, activeTab === 'invoices' && styles.segmentTabActive]}
          activeOpacity={0.9}
          onPress={() => setActiveTab('invoices')}
        >
          <Text style={[styles.segmentText, activeTab === 'invoices' && styles.segmentTextActive]}>
            Hóa đơn
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const getNextRange = (current: ReportRange): ReportRange =>
    current === 'month' ? 'today' : current === 'today' ? 'week' : 'month';

  const renderRangePill = (
    currentRange: ReportRange,
    onChangeRange: (nextRange: ReportRange) => void,
    testID: string
  ) => (
    <TouchableOpacity
      testID={testID}
      style={styles.rangePill}
      activeOpacity={0.85}
      onPress={() => onChangeRange(getNextRange(currentRange))}
    >
      <Text testID={`${testID}-label`} style={styles.rangeText}>{REPORT_RANGES[currentRange]}</Text>
      <MaterialIcons name="expand-more" size={18} color={colors.onSurfaceVariant} />
    </TouchableOpacity>
  );

  const renderChartRangeDropdown = () => (
    <View style={styles.chartRangeWrap}>
      <TouchableOpacity
        ref={chartRangeButtonRef}
        testID="report-chart-filter"
        style={styles.rangePill}
        activeOpacity={0.85}
        onPress={toggleChartRangeDropdown}
      >
        <Text testID="report-chart-filter-label" style={styles.rangeText}>
          {CHART_RANGE_OPTIONS.find((option) => option.value === chartRange)?.label}
        </Text>
        <MaterialIcons
          name={chartRangePickerOpen ? 'keyboard-arrow-up' : 'expand-more'}
          size={18}
          color={colors.onSurfaceVariant}
        />
      </TouchableOpacity>
    </View>
  );

  const renderChartRangeOptionsLayer = () => (
    <Modal
      transparent
      visible={chartRangePickerOpen}
      animationType="none"
      onRequestClose={() => setChartRangePickerOpen(false)}
    >
      <View testID="report-chart-filter-options-layer" style={styles.chartRangeModalLayer}>
        <TouchableOpacity
          testID="report-chart-filter-options-backdrop"
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setChartRangePickerOpen(false)}
        />
        <View
          testID="report-chart-filter-options"
          style={[
            styles.chartRangeOptions,
            styles.chartRangeOptionsFloating,
            {
              top: chartRangeAnchor.top,
              right: chartRangeAnchor.right,
              width: CHART_RANGE_DROPDOWN_WIDTH,
            },
          ]}
        >
          {CHART_RANGE_OPTIONS.map((option) => {
            const active = chartRange === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                testID={`report-chart-filter-option-${option.value}`}
                style={[styles.chartRangeOption, active && styles.chartRangeOptionActive]}
                activeOpacity={0.86}
                onPress={() => handleChangeChartRange(option.value)}
              >
                <Text style={[styles.chartRangeOptionText, active && styles.chartRangeOptionTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );

  const renderInvoiceRangeDropdown = () => (
    <View style={styles.chartRangeWrap}>
      <TouchableOpacity
        ref={invoiceRangeButtonRef}
        testID="report-invoices-filter"
        style={styles.rangePill}
        activeOpacity={0.85}
        onPress={toggleInvoiceRangeDropdown}
      >
        <Text testID="report-invoices-filter-label" style={styles.rangeText}>
          {CHART_RANGE_OPTIONS.find((option) => option.value === invoiceRange)?.label}
        </Text>
        <MaterialIcons
          name={invoiceRangePickerOpen ? 'keyboard-arrow-up' : 'expand-more'}
          size={18}
          color={colors.onSurfaceVariant}
        />
      </TouchableOpacity>
    </View>
  );

  const renderInvoiceRangeOptionsLayer = () => (
    <Modal
      transparent
      visible={invoiceRangePickerOpen}
      animationType="none"
      onRequestClose={() => setInvoiceRangePickerOpen(false)}
    >
      <View testID="report-invoices-filter-options-layer" style={styles.chartRangeModalLayer}>
        <TouchableOpacity
          testID="report-invoices-filter-options-backdrop"
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setInvoiceRangePickerOpen(false)}
        />
        <View
          testID="report-invoices-filter-options"
          style={[
            styles.chartRangeOptions,
            styles.chartRangeOptionsFloating,
            {
              top: invoiceRangeAnchor.top,
              right: invoiceRangeAnchor.right,
              width: CHART_RANGE_DROPDOWN_WIDTH,
            },
          ]}
        >
          {CHART_RANGE_OPTIONS.map((option) => {
            const active = invoiceRange === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                testID={`report-invoices-filter-option-${option.value}`}
                style={[styles.chartRangeOption, active && styles.chartRangeOptionActive]}
                activeOpacity={0.86}
                onPress={() => handleChangeInvoiceRange(option.value)}
              >
                <Text style={[styles.chartRangeOptionText, active && styles.chartRangeOptionTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );

  const renderRevenueChart = () => {
    const chart = (
      <View
        testID="report-revenue-chart"
        style={[
          styles.chart,
          isTablet && (chartRange === 'month' ? styles.chartTabletMonth : styles.chartTablet),
          chartRange === 'month' && styles.chartScrollableContent,
        ]}
      >
        {[0, 1, 2, 3].map((line) => (
          <View
            key={line}
            style={[styles.gridLine, isTablet ? { bottom: `${18 + line * 20}%` } : { bottom: 24 + line * 40 }]}
          />
        ))}
        {revenueChartBars.map((bar, index) => (
          <View
            key={`${bar.label}-${index}`}
            style={[styles.chartBarColumn, chartRange === 'month' && styles.chartBarColumnScrollable]}
          >
            <Text testID={`report-chart-bar-${index}-value`} style={styles.chartValue}>{bar.value}</Text>
            <View style={styles.chartTrack}>
              <View
                testID={`report-chart-bar-${index}-fill`}
                style={[
                  styles.chartBar,
                  { height: bar.height, backgroundColor: bar.isCurrent ? colors.secondary : colors.primary },
                ]}
              />
            </View>
            <Text
              testID={`report-chart-bar-${index}-label`}
              style={[styles.chartLabel, bar.isCurrent && styles.chartLabelEmphasis]}
            >
              {bar.label}
            </Text>
          </View>
        ))}
      </View>
    );

    if (chartRange !== 'month') return chart;

    return (
      <ScrollView
        testID="report-revenue-chart-scroll"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartScrollContainer}
      >
        {chart}
      </ScrollView>
    );
  };

  const renderRevenueCard = () => {
    const summaryBlock = (
      <View style={[styles.revenueSummary, isTablet && styles.revenueSummaryTablet]}>
        <Text style={styles.summaryLabel}>Tổng doanh thu</Text>
        <Text testID="report-total-revenue" style={styles.totalRevenue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{formatCompactMoney(revenueSummary.currentAmount)}</Text>
        <View style={styles.trendRow}>
          <MaterialIcons name={revenueSummary.trendIcon} size={14} color={revenueSummary.trendColor} />
          <Text style={[styles.trendText, { color: revenueSummary.trendColor }]}>
            {revenueSummary.trendText}
          </Text>
        </View>
      </View>
    );

    const breakdownBlock = (
      <View style={[styles.paymentBreakdown, isTablet && styles.paymentBreakdownTablet]}>
        <View style={styles.paymentItem}>
          <View style={styles.paymentItemHeader}>
            <MaterialIcons name="payments" size={16} color={colors.tertiary} />
            <Text style={styles.paymentItemLabel}>Tiền mặt</Text>
          </View>
          <Text testID="report-revenue-cash" style={styles.paymentItemValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formatCompactMoney(revenueSummary.cashAmount)}
          </Text>
        </View>
        <View style={styles.paymentDivider} />
        <View style={styles.paymentItem}>
          <View style={styles.paymentItemHeader}>
            <MaterialIcons name="account-balance" size={16} color={colors.primary} />
            <Text style={styles.paymentItemLabel}>Chuyển khoản</Text>
          </View>
          <Text testID="report-revenue-transfer" style={styles.paymentItemValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formatCompactMoney(revenueSummary.transferAmount)}
          </Text>
        </View>
      </View>
    );

    return (
    <View style={[styles.card, isTablet && styles.revenueCardTablet]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Doanh thu</Text>
        {isTablet ? (
          <View style={styles.revenueHeaderActions}>
            {renderChartRangeDropdown()}
            <TouchableOpacity
              testID="report-export-button"
              style={styles.exportButtonCompact}
              activeOpacity={0.9}
              onPress={openExportModal}
            >
              <MaterialIcons name="download" size={18} color={colors.white} />
              <Text style={styles.exportText}>Xuất báo cáo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          renderChartRangeDropdown()
        )}
      </View>

      {isTablet ? (
        <View style={styles.revenueTopRowTablet}>
          {summaryBlock}
          {breakdownBlock}
        </View>
      ) : (
        <>
          {summaryBlock}
          {breakdownBlock}
        </>
      )}

      {renderRevenueChart()}

      {!isTablet ? (
        <TouchableOpacity
          testID="report-export-button"
          style={styles.exportButton}
          activeOpacity={0.9}
          onPress={openExportModal}
        >
          <MaterialIcons name="download" size={20} color={colors.white} />
          <Text style={styles.exportText}>Xuất báo cáo</Text>
        </TouchableOpacity>
      ) : null}
    </View>
    );
  };

  const renderTopProductsCard = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Bán chạy nhất</Text>
        {renderRangePill(topProductsRange, setTopProductsRange, 'report-top-products-filter')}
      </View>
      <View style={styles.rankingList}>
        {topProducts.length > 0 ? (
          topProducts.map((item, index) => (
            <View key={item.name} style={styles.rankingRow}>
              <View style={styles.rankingInfo}>
                <View style={[styles.rankBadge, index === 0 && styles.rankBadgeFirst]}>
                  <Text style={[styles.rankText, index === 0 && styles.rankTextFirst]}>{index + 1}</Text>
                </View>
                <Text numberOfLines={1} style={styles.rankingName}>{item.name}</Text>
              </View>
              <Text style={styles.rankingQuantity}>{item.quantity} {item.unit}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="bar-chart" size={44} color={colors.outline} />
            <Text style={styles.emptyTitle}>Chưa có dữ liệu bán chạy</Text>
            <Text style={styles.emptyDescription}>Dữ liệu sẽ xuất hiện sau khi bạn tạo hóa đơn.</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderStatistics = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {renderRevenueCard()}
      {renderTopProductsCard()}
    </ScrollView>
  );

  // Tablet: chart (62%) + top sản phẩm (38%) cạnh nhau.
  const renderStatisticsTablet = () => (
    <View style={styles.tabletRow}>
      <View style={styles.tabletChartCol}>{renderRevenueCard()}</View>
      <ScrollView
        style={styles.tabletTopCol}
        contentContainerStyle={styles.tabletTopColContent}
        showsVerticalScrollIndicator={false}
      >
        {renderTopProductsCard()}
      </ScrollView>
    </View>
  );

  const renderInvoiceCard = (invoice: Invoice) => {
    const isCash = invoice.payment_method === 'tiền mặt';
    const warning = invoiceHasWarning(invoice);
    const selected = isTablet && selectedInvoice?.id != null && selectedInvoice.id === invoice.id;

    return (
      <TouchableOpacity
        key={invoice.id ?? invoice.invoice_code}
        testID={invoice.id ? `invoice-card-${invoice.id}` : undefined}
        style={[
          styles.invoiceCard,
          warning && styles.invoiceCardWarning,
          selected && styles.invoiceCardSelected,
        ]}
        activeOpacity={0.88}
        onPress={() => setSelectedInvoice(invoice)}
      >
        <View style={styles.invoiceInfo}>
          <View style={styles.invoiceMetaRow}>
            {warning ? <MaterialIcons name="warning" size={18} color={colors.onSurface} /> : null}
            <Text
              testID={invoice.id ? `invoice-card-${invoice.id}-code` : undefined}
              style={styles.invoiceCode}
            >
              {invoice.invoice_code}
            </Text>
            <View style={styles.dot} />
            <Text
              testID={invoice.id ? `invoice-card-${invoice.id}-time` : undefined}
              style={styles.invoiceTime}
            >
              {formatInvoiceTime(invoice.created_at)}
            </Text>
          </View>
          <Text
            testID={invoice.id ? `invoice-card-${invoice.id}-amount` : undefined}
            style={styles.invoiceAmount}
          >
            {formatDisplayMoney(invoice.final_amount)}
          </Text>
        </View>
        <View style={styles.invoiceRight}>
          <View
            testID={invoice.id ? `invoice-card-${invoice.id}-payment-badge` : undefined}
            style={[styles.paymentBadge, isCash ? styles.cashBadge : styles.transferBadge]}
          >
            <MaterialIcons
              name={isCash ? 'payments' : 'qr-code-scanner'}
              size={14}
              color={colors.white}
            />
            <Text
              testID={invoice.id ? `invoice-card-${invoice.id}-payment-text` : undefined}
              style={styles.paymentBadgeText}
            >
              {isCash ? 'Tiền mặt' : 'Chuyển khoản'}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.outline} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderInvoices = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.invoiceFilterRow}>
        <Text style={styles.cardTitle}>Lịch sử giao dịch</Text>
        {renderInvoiceRangeDropdown()}
      </View>

      <View style={styles.invoiceList}>
        {historyInvoiceGroups.length > 0 ? (
          historyInvoiceGroups.map((group) => (
            <View
              key={group.dateKey}
              testID={`invoice-date-group-${group.dateKey}`}
              style={styles.invoiceGroup}
            >
              <Text style={styles.invoiceGroupTitle}>{group.label}</Text>
              <View style={styles.invoiceGroupCards}>
                {group.invoices.map(renderInvoiceCard)}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyStateLarge}>
            <View style={styles.emptyIconCircle}>
              <MaterialIcons name="receipt-long" size={44} color={colors.outline} />
            </View>
            <Text style={styles.emptyTitle}>Chưa có hóa đơn nào</Text>
            <Text style={styles.emptyDescription}>
              Các hóa đơn thanh toán trong ngày sẽ được hiển thị tại đây.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  // Panel chi tiết hóa đơn (bố cục bảng theo design tablet).
  const renderInvoiceDetailPanel = (invoice: Invoice) => {
    const isCash = invoice.payment_method === 'tiền mặt';
    const subtotal = invoice.subtotal_amount || invoice.items.reduce((sum, item) => sum + item.amount, 0);
    return (
      <View testID="invoice-detail-panel" style={styles.detailPanel}>
        <View style={styles.detailPanelHeader}>
          <View style={styles.detailPanelHeaderTop}>
            <View>
              <Text style={styles.detailPanelEyebrow}>CHI TIẾT HÓA ĐƠN</Text>
              <Text style={styles.detailPanelCode}>{invoice.invoice_code}</Text>
            </View>
            <View style={styles.detailPanelActions}>
              <View style={styles.detailPanelIconBtn}>
                <MaterialIcons name="print" size={20} color={colors.white} />
              </View>
              <View style={styles.detailPanelIconBtn}>
                <MaterialIcons name="download" size={20} color={colors.white} />
              </View>
            </View>
          </View>
          <View style={styles.detailPanelMetaRow}>
            <View style={styles.detailPanelMetaItem}>
              <Text style={styles.detailPanelMetaLabel}>Thời gian</Text>
              <Text style={styles.detailPanelMetaValue}>{formatInvoiceDetailDateTime(invoice.created_at)}</Text>
            </View>
            <View style={styles.detailPanelMetaItem}>
              <Text style={styles.detailPanelMetaLabel}>Thanh toán</Text>
              <Text style={styles.detailPanelMetaValue}>{isCash ? 'Tiền mặt' : 'Chuyển khoản'}</Text>
            </View>
            <View style={styles.detailPanelMetaItem}>
              <Text style={styles.detailPanelMetaLabel}>Khách hàng</Text>
              <Text style={styles.detailPanelMetaValue}>{invoice.customer_name || 'Khách lẻ'}</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.detailPanelBody} contentContainerStyle={styles.detailPanelBodyContent} showsVerticalScrollIndicator={false}>
          <View style={styles.detailTableHeader}>
            <Text style={[styles.detailTh, styles.detailColIdx]}>STT</Text>
            <Text style={[styles.detailTh, styles.detailColName]}>Sản phẩm</Text>
            <Text style={[styles.detailTh, styles.detailColQty]}>SL</Text>
            <Text style={[styles.detailTh, styles.detailColPrice]}>Đơn giá</Text>
            <Text style={[styles.detailTh, styles.detailColAmount]}>Thành tiền</Text>
          </View>
          {invoice.items.map((item, index) => (
            <View key={`${item.product_name}-${item.product_id ?? index}`} style={styles.detailTableRow}>
              <Text style={[styles.detailTd, styles.detailColIdx]}>{String(index + 1).padStart(2, '0')}</Text>
              <Text style={[styles.detailTd, styles.detailColName, styles.detailTdName]} numberOfLines={1}>{item.product_name}</Text>
              <Text style={[styles.detailTd, styles.detailColQty]}>{item.quantity}</Text>
              <Text style={[styles.detailTd, styles.detailColPrice, styles.detailTdMuted]}>{formatCompactMoney(item.unit_price)}</Text>
              <Text style={[styles.detailTd, styles.detailColAmount, styles.detailTdStrong]}>{formatCompactMoney(item.amount)}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.detailSummary}>
          <View style={styles.detailSummaryInner}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>Tổng tiền hàng</Text>
              <Text style={styles.summaryText}>{formatDisplayMoney(subtotal)}</Text>
            </View>
            {invoice.discount_amount > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryText}>Giảm giá</Text>
                <Text style={[styles.summaryText, { color: colors.errorCrimson }]}>-{formatDisplayMoney(invoice.discount_amount)}</Text>
              </View>
            ) : null}
            <View style={styles.summaryDivider} />
            <View style={styles.detailFinalRow}>
              <Text style={styles.summaryTotalLabel}>Khách cần trả</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.summaryTotal}>{formatDisplayMoney(invoice.final_amount)}</Text>
                <View style={styles.detailPayHint}>
                  <MaterialIcons name={isCash ? 'payments' : 'qr-code-scanner'} size={14} color={colors.onSurfaceVariant} />
                  <Text style={styles.detailPayHintText}>{isCash ? 'Tiền mặt' : 'Chuyển khoản'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // Tablet: master-detail — danh sách trái + chi tiết inline phải.
  const renderInvoicesTablet = () => (
    <View style={styles.tabletRow}>
      <View style={styles.tabletInvoiceListCol}>
        <View style={styles.invoiceFilterRow}>
          <Text style={styles.cardTitle}>Lịch sử giao dịch</Text>
          {renderInvoiceRangeDropdown()}
        </View>
        <ScrollView style={styles.content} contentContainerStyle={styles.tabletListContent} showsVerticalScrollIndicator={false}>
          {historyInvoiceGroups.length > 0 ? (
            historyInvoiceGroups.map((group) => (
              <View key={group.dateKey} testID={`invoice-date-group-${group.dateKey}`} style={styles.invoiceGroup}>
                <Text style={styles.invoiceGroupTitle}>{group.label}</Text>
                <View style={styles.invoiceGroupCards}>{group.invoices.map(renderInvoiceCard)}</View>
              </View>
            ))
          ) : (
            <View style={styles.emptyStateLarge}>
              <View style={styles.emptyIconCircle}>
                <MaterialIcons name="receipt-long" size={44} color={colors.outline} />
              </View>
              <Text style={styles.emptyTitle}>Chưa có hóa đơn nào</Text>
            </View>
          )}
        </ScrollView>
      </View>

      <View style={styles.tabletInvoiceDetailCol}>
        {selectedInvoice ? (
          renderInvoiceDetailPanel(selectedInvoice)
        ) : (
          <View testID="invoice-detail-empty" style={styles.detailEmpty}>
            <MaterialIcons name="receipt-long" size={48} color={colors.outline} />
            <Text style={styles.emptyDescription}>Chọn một hóa đơn để xem chi tiết.</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderInvoiceDetail = () => {
    if (!selectedInvoice) return null;
    const isCash = selectedInvoice.payment_method === 'tiền mặt';
    const subtotal = selectedInvoice.subtotal_amount || selectedInvoice.items.reduce((sum, item) => sum + item.amount, 0);

    return (
      <Modal transparent visible animationType="fade" onRequestClose={() => setSelectedInvoice(null)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSelectedInvoice(null)} />
          <View testID="invoice-detail-sheet" style={styles.sheet}>
            <TouchableOpacity style={styles.sheetHandleWrap} activeOpacity={0.8} onPress={() => setSelectedInvoice(null)}>
              <View style={styles.sheetHandle} />
            </TouchableOpacity>
            <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetTitle}>{selectedInvoice.invoice_code}</Text>
                  <Text style={styles.sheetTime}>
                    {formatInvoiceDetailDateTime(selectedInvoice.created_at)}
                  </Text>
                </View>
                <View style={[styles.paymentBadge, isCash ? styles.cashBadge : styles.transferBadge]}>
                  <MaterialIcons name={isCash ? 'payments' : 'qr-code-scanner'} size={16} color={colors.white} />
                  <Text style={styles.paymentBadgeText}>{isCash ? 'Tiền mặt' : 'Chuyển khoản'}</Text>
                </View>
              </View>

              <Text style={styles.detailSectionTitle}>Chi tiết sản phẩm</Text>
              <View style={styles.detailItems}>
                {selectedInvoice.items.map((item) => (
                  <View key={`${item.product_name}-${item.product_id ?? 'custom'}`} style={styles.detailItemRow}>
                    <View style={styles.detailItemLeft}>
                      <View style={styles.quantityBadge}>
                        <Text style={styles.quantityText}>x{item.quantity}</Text>
                      </View>
                      <View>
                        <Text style={styles.detailItemName}>{item.product_name}</Text>
                        <Text style={styles.detailItemPrice}>{formatDisplayMoney(item.unit_price)}</Text>
                      </View>
                    </View>
                    <Text style={styles.detailAmount}>{formatDisplayMoney(item.amount)}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText}>Tạm tính</Text>
                  <Text style={styles.summaryText}>{formatDisplayMoney(subtotal)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText}>Giảm giá</Text>
                  <Text style={styles.summaryText}>{formatDisplayMoney(selectedInvoice.discount_amount)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryTotalLabel}>Tổng cộng</Text>
                  <Text style={styles.summaryTotal}>{formatDisplayMoney(selectedInvoice.final_amount)}</Text>
                </View>
              </View>

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  testID="invoice-detail-print-button"
                  style={[styles.secondaryAction, styles.disabledSheetAction]}
                  activeOpacity={1}
                  disabled
                  accessibilityState={{ disabled: true }}
                >
                  <MaterialIcons name="print" size={20} color={colors.onSurfaceVariant} />
                  <Text style={[styles.secondaryActionText, styles.disabledSheetActionText]}>In lại</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="invoice-detail-cancel-button"
                  style={[styles.dangerAction, styles.disabledSheetAction]}
                  activeOpacity={1}
                  disabled
                  accessibilityState={{ disabled: true }}
                >
                  <MaterialIcons name="delete" size={20} color={colors.onSurfaceVariant} />
                  <Text style={[styles.dangerActionText, styles.disabledSheetActionText]}>Hủy HD</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.main}>
        {renderSegmentedTabs()}
        {activeTab === 'statistics'
          ? (isTablet ? renderStatisticsTablet() : renderStatistics())
          : (isTablet ? renderInvoicesTablet() : renderInvoices())}
      </View>

      {renderChartRangeOptionsLayer()}
      {renderInvoiceRangeOptionsLayer()}

      <Modal transparent visible={exportVisible} animationType="fade" onRequestClose={() => setExportVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setExportVisible(false)} />
          <View testID="report-export-modal" style={styles.exportModal}>
            <View style={styles.exportModalHeader}>
              <Text style={styles.modalTitle}>Xuất báo cáo Excel</Text>
              <TouchableOpacity
                testID="report-export-close"
                style={styles.exportCloseButton}
                activeOpacity={0.8}
                onPress={() => setExportVisible(false)}
              >
                <MaterialIcons name="close" size={24} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <View style={styles.exportForm}>
              <View style={styles.exportSection}>
                <Text style={styles.exportLabel}>Loại báo cáo</Text>
                <View style={styles.exportTypeRow}>
                  {([
                    { value: 'day', label: 'Xuất theo ngày' },
                    { value: 'month', label: 'Xuất theo tháng' },
                  ] as { value: ExportMode; label: string }[]).map((option) => {
                    const active = exportMode === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        testID={`report-export-type-${option.value}`}
                        style={[styles.exportTypeButton, active && styles.exportTypeButtonActive]}
                        activeOpacity={0.86}
                        onPress={() => handleChangeExportMode(option.value)}
                      >
                        <Text style={[styles.exportTypeText, active && styles.exportTypeTextActive]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {exportMode === 'day' ? (
                <View style={styles.exportSection}>
                  <Text style={styles.exportLabel}>Chọn khoảng ngày</Text>
                  <View style={styles.dayFieldsRow}>
                    <View style={styles.dayFieldCol}>
                      <Text style={styles.dayFieldLabel}>Từ ngày</Text>
                      <TouchableOpacity
                        testID="report-export-day-start"
                        style={[
                          styles.exportPickerField,
                          activeDayField === 'start' && styles.exportPickerFieldActive,
                        ]}
                        activeOpacity={0.86}
                        onPress={() => openDayPicker('start')}
                      >
                        <Text
                          style={[
                            styles.exportPickerText,
                            !dayStartKey && styles.exportPickerPlaceholder,
                          ]}
                        >
                          {dayStartKey ? formatDateKeyForDisplay(dayStartKey) : 'Chọn ngày'}
                        </Text>
                        <MaterialIcons name="calendar-today" size={20} color={colors.onSurface} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.dayFieldCol}>
                      <Text style={styles.dayFieldLabel}>Đến ngày</Text>
                      <TouchableOpacity
                        testID="report-export-day-end"
                        style={[
                          styles.exportPickerField,
                          activeDayField === 'end' && styles.exportPickerFieldActive,
                        ]}
                        activeOpacity={0.86}
                        onPress={() => openDayPicker('end')}
                      >
                        <Text style={styles.exportPickerText}>
                          {formatDateKeyForDisplay(dayEndKey)}
                        </Text>
                        <MaterialIcons name="calendar-today" size={20} color={colors.onSurface} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.exportSection}>
                  <Text style={styles.exportLabel}>Chọn tháng</Text>
                  <View style={styles.monthGrid}>
                    {MONTHS.map((month) => {
                      const disabled = month > currentMonthNum;
                      const selected = month === selectedMonthNum;
                      return (
                        <TouchableOpacity
                          key={month}
                          testID={`report-export-month-${month}`}
                          style={[
                            styles.monthButton,
                            disabled
                              ? styles.monthButtonDisabled
                              : selected
                                ? styles.monthButtonSelected
                                : styles.monthButtonPast,
                          ]}
                          activeOpacity={disabled ? 1 : 0.85}
                          disabled={disabled}
                          accessibilityState={{ disabled, selected }}
                          onPress={() => setSelectedMonthNum(month)}
                        >
                          <Text
                            style={[
                              styles.monthButtonText,
                              disabled
                                ? styles.monthButtonTextDisabled
                                : selected
                                  ? styles.monthButtonTextSelected
                                  : styles.monthButtonTextPast,
                            ]}
                          >
                            Tháng {month}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={styles.exportPreviewBox}>
                <Text style={styles.exportPreviewTitle}>XEM TRƯỚC PHẠM VI</Text>
                <Text testID="report-export-preview" style={styles.exportPreviewText}>
                  {exportRangePreview
                    ? `Phạm vi: ${exportRangePreview}`
                    : 'Chọn ngày bắt đầu để xem phạm vi'}
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                testID="report-export-cancel"
                style={styles.modalCancel}
                activeOpacity={0.85}
                onPress={() => setExportVisible(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="report-export-confirm"
                style={[styles.modalConfirm, !canExport && styles.modalConfirmDisabled]}
                activeOpacity={0.9}
                onPress={handleConfirmExport}
                disabled={exporting || !canExport}
              >
                {exporting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.modalConfirmText}>Xuất file</Text>}
              </TouchableOpacity>
            </View>
          </View>

          {Platform.OS === 'ios' && activeDayField ? (
            <View style={styles.pickerOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => setActiveDayField(null)}
              />
              <View testID="report-export-picker-popup" style={styles.pickerModalCard}>
                <View style={styles.pickerModalHeader}>
                  <Text style={styles.pickerModalTitle}>
                    {activeDayField === 'start' ? 'Chọn ngày bắt đầu' : 'Chọn ngày kết thúc'}
                  </Text>
                  <TouchableOpacity
                    testID="report-export-picker-done"
                    activeOpacity={0.8}
                    onPress={() => setActiveDayField(null)}
                  >
                    <Text style={styles.pickerModalDone}>Xong</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  testID="report-export-native-date-picker"
                  value={(activeDayField === 'start' ? dayStartDate : dayEndDate) ?? dayEndDate}
                  mode="date"
                  display="inline"
                  maximumDate={activeDayField === 'start' ? dayEndDate : maxExportDate}
                  minimumDate={activeDayField === 'end' ? dayStartDate : undefined}
                  locale="vi-VN"
                  onChange={handleChangeDayDate(activeDayField)}
                />
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      {isTablet ? null : renderInvoiceDetail()}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  main: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  // ===== Tablet layout =====
  tabletRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  tabletChartCol: {
    width: '62%',
  },
  tabletTopCol: {
    flex: 1,
  },
  tabletTopColContent: {
    paddingBottom: 8,
  },
  tabletInvoiceListCol: {
    width: '42%',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.card,
    paddingTop: 8,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  tabletInvoiceDetailCol: {
    flex: 1,
  },
  tabletListContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 16,
  },
  invoiceCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainerFaint,
  },
  detailEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.card,
  },
  detailPanel: {
    flex: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLowest,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  detailPanelHeader: {
    backgroundColor: colors.primary,
    padding: 20,
    gap: 16,
  },
  detailPanelHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  detailPanelEyebrow: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.primaryContainer,
  },
  detailPanelCode: {
    fontFamily: fontFamily.jakartaBold,
    fontSize: 24,
    lineHeight: 32,
    color: colors.white,
  },
  detailPanelActions: {
    flexDirection: 'row',
    gap: 8,
  },
  detailPanelIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  detailPanelMetaRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  detailPanelMetaItem: {
    flex: 1,
    gap: 4,
  },
  detailPanelMetaLabel: {
    fontFamily: fontFamily.interMedium,
    fontSize: 12,
    color: colors.primaryContainer,
  },
  detailPanelMetaValue: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 14,
    color: colors.white,
  },
  detailPanelBody: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
  },
  detailPanelBodyContent: {
    padding: 20,
    gap: 4,
  },
  detailTableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    marginBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: colors.surfaceContainer,
  },
  detailTh: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  detailTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailTd: {
    ...typography.bodySm,
    color: colors.onSurface,
  },
  detailTdName: {
    fontFamily: fontFamily.interSemiBold,
  },
  detailTdMuted: {
    color: colors.onSurfaceVariant,
  },
  detailTdStrong: {
    fontFamily: fontFamily.interSemiBold,
  },
  detailColIdx: { width: 36 },
  detailColName: { flex: 1 },
  detailColQty: { width: 44, textAlign: 'right' },
  detailColPrice: { width: 90, textAlign: 'right' },
  detailColAmount: { width: 100, textAlign: 'right' },
  detailSummary: {
    backgroundColor: colors.surfaceBright,
    borderTopWidth: 2,
    borderTopColor: colors.surfaceContainer,
    padding: 20,
    alignItems: 'flex-end',
  },
  detailSummaryInner: {
    width: '60%',
    gap: 10,
  },
  detailFinalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  detailPayHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  detailPayHintText: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  tabsOuter: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  tabsInner: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceContainerHigh,
  },
  segmentTab: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentTabActive: {
    backgroundColor: colors.primary,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },
  segmentTextActive: {
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  card: {
    borderRadius: radius.card,
    padding: 16,
    backgroundColor: colors.surfaceContainerLowest,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  revenueCardTablet: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.onSurface,
  },
  rangePill: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
  },
  rangeText: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
  },
  chartRangeWrap: {
    position: 'relative',
    zIndex: 10,
    alignItems: 'flex-end',
  },
  chartRangeModalLayer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  chartRangeOptions: {
    position: 'absolute',
    top: 40,
    right: 0,
    width: CHART_RANGE_DROPDOWN_WIDTH,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  chartRangeOptionsFloating: {
    zIndex: 999,
    elevation: 24,
  },
  chartRangeOption: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  chartRangeOptionActive: {
    backgroundColor: colors.primaryContainerFaint,
  },
  chartRangeOptionText: {
    ...typography.labelSm,
    color: colors.onSurface,
  },
  chartRangeOptionTextActive: {
    fontFamily: fontFamily.interBold,
    color: colors.primary,
  },
  revenueSummary: {
    marginBottom: 12,
  },
  summaryLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginBottom: 4,
  },
  totalRevenue: {
    ...typography.headlineLgMobile,
    color: colors.primary,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  trendText: {
    ...typography.labelSm,
    color: colors.tertiary,
  },
  paymentBreakdown: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  revenueTopRowTablet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 8,
  },
  revenueSummaryTablet: {
    flex: 1,
    marginBottom: 0,
  },
  paymentBreakdownTablet: {
    marginBottom: 0,
    alignSelf: 'flex-start',
    minWidth: 320,
  },
  paymentItem: {
    flex: 1,
    paddingHorizontal: 8,
    gap: 6,
  },
  paymentItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentItemLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
  },
  paymentItemValue: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.onSurface,
  },
  paymentDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariant,
    marginVertical: 2,
  },
  chart: {
    height: 204,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingTop: 18,
    paddingBottom: 24,
    marginTop: 4,
  },
  chartTablet: {
    height: undefined,
    flex: 1,
    minHeight: 240,
  },
  chartTabletMonth: {
    height: 360,
  },
  chartScrollContainer: {
    paddingRight: 4,
  },
  chartScrollableContent: {
    width: 560,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariantSoft,
  },
  chartBarColumn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartBarColumnScrollable: {
    width: 40,
    flex: 0,
  },
  chartValue: {
    ...typography.labelSm,
    color: colors.primary,
    marginBottom: 4,
  },
  chartTrack: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    backgroundColor: colors.primaryContainerFaint,
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  chartLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    marginTop: 8,
  },
  chartLabelEmphasis: {
    fontFamily: fontFamily.interBold,
    color: colors.onSurface,
  },
  exportButton: {
    minHeight: 48,
    marginTop: 16,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  revenueHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exportButtonCompact: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
  },
  exportText: {
    ...typography.labelMd,
    color: colors.white,
  },
  rankingList: {
    gap: 12,
  },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rankingInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  rankBadgeFirst: {
    backgroundColor: colors.primary,
  },
  rankText: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
  },
  rankTextFirst: {
    color: colors.white,
  },
  rankingName: {
    flex: 1,
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  rankingQuantity: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },
  invoiceFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  invoiceList: {
    gap: 28,
  },
  invoiceGroup: {
    gap: 12,
  },
  invoiceGroupTitle: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1.3,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  invoiceGroupCards: {
    gap: 12,
  },
  invoiceCard: {
    minHeight: 92,
    borderRadius: radius.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.surfaceContainerLowest,
    backgroundColor: colors.surfaceContainerLowest,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  invoiceCardWarning: {
    borderColor: colors.warningAmber,
    backgroundColor: colors.warningSurface,
  },
  invoiceInfo: {
    flex: 1,
    gap: 6,
  },
  invoiceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  invoiceCode: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outline,
  },
  invoiceTime: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  invoiceAmount: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.onSurface,
  },
  invoiceRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  paymentBadge: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
  },
  cashBadge: {
    backgroundColor: colors.secondary,
  },
  transferBadge: {
    backgroundColor: colors.tertiary,
  },
  paymentBadgeText: {
    ...typography.labelSm,
    color: colors.white,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  emptyStateLarge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainer,
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 20,
    lineHeight: 28,
    color: colors.onSurface,
    textAlign: 'center',
  },
  emptyDescription: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 260,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  exportModal: {
    borderRadius: radius.xl,
    padding: 24,
    backgroundColor: colors.surfaceContainerLowest,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 28,
    elevation: 12,
  },
  exportModalHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  modalTitle: {
    flex: 1,
    fontFamily: fontFamily.jakartaBold,
    fontSize: 21,
    lineHeight: 30,
    color: colors.onSurface,
  },
  exportCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginRight: -4,
  },
  modalDescription: {
    fontFamily: fontFamily.interRegular,
    fontSize: 16,
    lineHeight: 25,
    color: colors.outline,
    marginTop: 24,
    marginBottom: 26,
  },
  exportForm: {
    gap: 22,
  },
  exportSection: {
    gap: 10,
  },
  exportLabel: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.onSurface,
  },
  exportTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  exportTypeButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  exportTypeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  exportTypeText: {
    fontFamily: fontFamily.interMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface,
  },
  exportTypeTextActive: {
    fontFamily: fontFamily.interBold,
    color: colors.white,
  },
  exportPickerField: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  exportDatePickerField: {
    gap: 12,
  },
  exportPickerText: {
    fontFamily: fontFamily.interRegular,
    fontSize: 17,
    lineHeight: 26,
    color: colors.onSurface,
  },
  exportOptionsList: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  exportOptionRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  exportOptionRowActive: {
    backgroundColor: colors.primaryContainerFaint,
  },
  exportOptionText: {
    fontFamily: fontFamily.interRegular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurface,
  },
  exportOptionTextActive: {
    fontFamily: fontFamily.interBold,
    color: colors.primary,
  },
  exportPreviewBox: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: '#F1F4F8',
  },
  exportPreviewTitle: {
    fontFamily: fontFamily.interBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    color: colors.onSurface,
    marginBottom: 6,
  },
  exportPreviewText: {
    fontFamily: fontFamily.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 32,
  },
  modalCancel: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.errorCrimson,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  modalCancelText: {
    fontFamily: fontFamily.interBold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.errorCrimson,
  },
  modalConfirm: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  modalConfirmDisabled: {
    opacity: 0.45,
  },
  dayFieldsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dayFieldCol: {
    flex: 1,
    gap: 6,
  },
  dayFieldLabel: {
    fontFamily: fontFamily.interMedium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurfaceVariant,
  },
  exportPickerFieldActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  exportPickerPlaceholder: {
    color: colors.onSurfaceVariant,
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    elevation: 1000,
  },
  pickerModalCard: {
    borderRadius: radius.xl,
    padding: 16,
    backgroundColor: colors.surfaceContainerLowest,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 28,
    elevation: 12,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  pickerModalTitle: {
    fontFamily: fontFamily.jakartaSemiBold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.onSurface,
  },
  pickerModalDone: {
    fontFamily: fontFamily.interBold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.primary,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  monthButton: {
    width: '30%',
    flexGrow: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  monthButtonSelected: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  monthButtonPast: {
    backgroundColor: colors.white,
    borderColor: colors.primary,
  },
  monthButtonDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  monthButtonText: {
    fontFamily: fontFamily.interSemiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  monthButtonTextSelected: {
    color: colors.white,
  },
  monthButtonTextPast: {
    color: colors.primary,
  },
  monthButtonTextDisabled: {
    color: '#94A3B8',
  },
  modalConfirmText: {
    fontFamily: fontFamily.interBold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.white,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(5, 22, 58, 0.4)',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLowest,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 40,
    elevation: 12,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  sheetHandle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.outlineVariant,
  },
  sheetBody: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  sheetTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
  },
  sheetTime: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: 4,
  },
  detailSectionTitle: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  detailItems: {
    gap: 16,
    marginBottom: 24,
  },
  detailItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tertiary,
  },
  quantityText: {
    ...typography.labelMd,
    color: colors.white,
  },
  detailItemName: {
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  detailItemPrice: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  detailAmount: {
    ...typography.labelMd,
    color: colors.onSurface,
  },
  summaryBox: {
    padding: 16,
    borderRadius: radius.card,
    gap: 8,
    backgroundColor: colors.surfaceContainerLow,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariantSoft,
    marginVertical: 4,
  },
  summaryTotalLabel: {
    ...typography.labelMd,
    color: colors.onSurface,
  },
  summaryTotal: {
    ...typography.headlineLgMobile,
    color: colors.primary,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surfaceContainer,
  },
  secondaryActionText: {
    ...typography.labelMd,
    color: colors.onSurface,
  },
  disabledSheetAction: {
    opacity: 0.45,
  },
  disabledSheetActionText: {
    color: colors.onSurfaceVariant,
  },
  dangerAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.errorContainerFaint,
  },
  dangerActionText: {
    ...typography.labelMd,
    color: colors.errorCrimson,
  },
});
