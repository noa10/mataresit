/**
 * Malaysian Cultural Utilities
 * Provides formatting and cultural adaptation functions for Malaysian users
 */

export interface MalaysianCulturalPreferences {
  date_format: string;
  time_format: string;
  number_format: string;
  timezone: string;
  cultural_context: string;
  language: string;
}

export interface MalaysianHoliday {
  is_holiday: boolean;
  holiday_name?: string;
  holiday_name_malay?: string;
  holiday_type?: string;
  applicable_states?: string[];
}

/**
 * Default Malaysian cultural preferences
 */
export const DEFAULT_MALAYSIAN_PREFERENCES: MalaysianCulturalPreferences = {
  date_format: 'DD/MM/YYYY',
  time_format: '24h',
  number_format: 'MY',
  timezone: 'Asia/Kuala_Lumpur',
  cultural_context: 'MY',
  language: 'en'
};

/**
 * Malaysian state codes mapping
 */
export const MALAYSIAN_STATES = {
  'JHR': 'Johor',
  'KDH': 'Kedah',
  'KTN': 'Kelantan',
  'MLK': 'Melaka',
  'NSN': 'Negeri Sembilan',
  'PHG': 'Pahang',
  'PNG': 'Penang',
  'PRK': 'Perak',
  'PLS': 'Perlis',
  'SBH': 'Sabah',
  'SRW': 'Sarawak',
  'SEL': 'Selangor',
  'TRG': 'Terengganu',
  'KL': 'Kuala Lumpur',
  'LBN': 'Labuan',
  'PJY': 'Putrajaya'
};

/**
 * Format date according to Malaysian preferences
 */
export function formatMalaysianDate(
  date: Date | string,
  format: string = 'DD/MM/YYYY',
  separator: string = '/'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear().toString();

  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}${separator}${month}${separator}${year}`;
    case 'MM/DD/YYYY':
      return `${month}${separator}${day}${separator}${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD-MM-YYYY':
      return `${day}-${month}-${year}`;
    default:
      return `${day}/${month}/${year}`;
  }
}

/**
 * Format time according to Malaysian preferences
 */
export function formatMalaysianTime(
  time: Date | string,
  format: string = '24h',
  separator: string = ':'
): string {
  const timeObj = typeof time === 'string' ? new Date(`1970-01-01T${time}`) : time;
  
  if (isNaN(timeObj.getTime())) {
    return 'Invalid Time';
  }

  const hours24 = timeObj.getHours();
  const minutes = timeObj.getMinutes().toString().padStart(2, '0');

  if (format === '12h') {
    const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    return `${hours12.toString().padStart(2, '0')}${separator}${minutes} ${ampm}`;
  } else {
    return `${hours24.toString().padStart(2, '0')}${separator}${minutes}`;
  }
}

/**
 * Format number according to Malaysian preferences
 */
export function formatMalaysianNumber(
  number: number,
  style: string = 'MY',
  thousandsSep: string = ',',
  decimalSep: string = '.'
): string {
  if (isNaN(number)) {
    return 'Invalid Number';
  }

  const parts = number.toFixed(2).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  let formattedInteger: string;

  switch (style) {
    case 'EU':
      // European style: 1.234,56
      formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return decimalPart !== '00' ? `${formattedInteger},${decimalPart}` : formattedInteger;
    case 'MY':
    case 'US':
    default:
      // Malaysian/US style: 1,234.56
      formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
      return decimalPart !== '00' ? `${formattedInteger}${decimalSep}${decimalPart}` : formattedInteger;
  }
}

/**
 * Format currency in Malaysian Ringgit
 */
export function formatMalaysianCurrency(
  amount: number,
  includeSymbol: boolean = true,
  style: string = 'MY'
): string {
  const formattedAmount = formatMalaysianNumber(amount, style);
  return includeSymbol ? `RM ${formattedAmount}` : formattedAmount;
}

/**
 * Get Malaysian business greeting based on time
 */
export function getMalaysianBusinessGreeting(language: string = 'en'): string {
  const hour = new Date().getHours();
  
  if (language === 'ms') {
    if (hour < 12) return 'Selamat pagi';
    if (hour < 17) return 'Selamat tengah hari';
    if (hour < 19) return 'Selamat petang';
    return 'Selamat malam';
  } else {
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 19) return 'Good evening';
    return 'Good night';
  }
}

/**
 * Check if current time is within Malaysian business hours
 */
export function isMalaysianBusinessHours(businessType: string = 'general'): boolean {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Weekend check (Saturday = 6, Sunday = 0)
  if (day === 0 || day === 6) {
    // Some businesses open on weekends
    if (businessType === 'retail' || businessType === 'restaurant') {
      return hour >= 10 && hour < 22;
    }
    return false;
  }

  // Weekday business hours
  switch (businessType) {
    case 'bank':
      return hour >= 9 && hour < 16;
    case 'government':
      return hour >= 8 && hour < 17;
    case 'retail':
      return hour >= 10 && hour < 22;
    case 'restaurant':
      return hour >= 10 && hour < 23;
    default:
      return hour >= 9 && hour < 18;
  }
}

/**
 * Get Malaysian timezone offset
 */
export function getMalaysianTimezoneOffset(): number {
  // Malaysia is UTC+8
  return 8;
}

/**
 * Convert UTC time to Malaysian time
 */
export function convertToMalaysianTime(utcDate: Date): Date {
  const malaysianTime = new Date(utcDate);
  malaysianTime.setHours(malaysianTime.getHours() + getMalaysianTimezoneOffset());
  return malaysianTime;
}

/**
 * Get culturally appropriate color scheme for Malaysian users
 */
export function getMalaysianColorScheme() {
  return {
    primary: '#C41E3A', // Malaysian flag red
    secondary: '#FFD700', // Malaysian flag yellow
    accent: '#000080', // Malaysian flag blue
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#17a2b8'
  };
}

/**
 * Validate Malaysian phone number format
 */
export function validateMalaysianPhoneNumber(phone: string): boolean {
  // Malaysian phone number patterns
  const patterns = [
    /^(\+?6?01)[0-46-9]-*[0-9]{7,8}$/, // Mobile numbers
    /^(\+?603)[0-9]{8}$/, // KL landline
    /^(\+?60[4-9])[0-9]{7}$/, // Other state landlines
  ];
  
  return patterns.some(pattern => pattern.test(phone.replace(/\s/g, '')));
}

/**
 * Format Malaysian phone number
 */
export function formatMalaysianPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('60')) {
    // International format
    if (cleaned.length === 11 && cleaned.startsWith('601')) {
      // Mobile: +60 1X-XXX XXXX
      return `+60 ${cleaned.substring(2, 4)}-${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
    } else if (cleaned.length === 11) {
      // Landline: +60 X-XXXX XXXX
      return `+60 ${cleaned.substring(2, 3)}-${cleaned.substring(3, 7)} ${cleaned.substring(7)}`;
    }
  } else if (cleaned.startsWith('01')) {
    // Local mobile format
    return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 6)} ${cleaned.substring(6)}`;
  } else if (cleaned.startsWith('0')) {
    // Local landline format
    return `${cleaned.substring(0, 2)}-${cleaned.substring(2, 6)} ${cleaned.substring(6)}`;
  }
  
  return phone; // Return original if no pattern matches
}
