export const HO_CHI_MINH_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const getHoChiMinhParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: HO_CHI_MINH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

export const formatHoChiMinhDateKey = (date: Date = new Date()) => {
  const parts = getHoChiMinhParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const formatHoChiMinhDateTime = (date: Date = new Date()) => {
  const parts = getHoChiMinhParts(date);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

export const formatHoChiMinhInvoiceTime = (date: Date = new Date()) => {
  const parts = getHoChiMinhParts(date);
  return `${parts.hour}:${parts.minute} - ${parts.day}/${parts.month}/${parts.year}`;
};

export const getHoChiMinhDaysAgoDateKey = (daysAgo: number, date: Date = new Date()) =>
  formatHoChiMinhDateKey(new Date(date.getTime() - daysAgo * 24 * 60 * 60 * 1000));

export const getHoChiMinhMonthStartDateKey = (date: Date = new Date()) => {
  const parts = getHoChiMinhParts(date);
  return `${parts.year}-${parts.month}-01`;
};
