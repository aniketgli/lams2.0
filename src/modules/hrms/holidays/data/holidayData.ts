export interface HolidayItem {
  id: string;
  name: string;
  hindiName?: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  type: 'gazetted' | 'restricted' | 'local';
  category: 'National' | 'Religious' | 'Cultural' | 'Institutional' | 'International';
  description: string;
  year: number;
  month: number; // 1-12
  isLongWeekend?: boolean;
}

export const INITIAL_HOLIDAYS: HolidayItem[] = [
  // ================= 2026 Gazetted Holidays =================
  {
    id: 'gh-2026-01',
    name: 'Republic Day',
    hindiName: 'गणतंत्र दिवस',
    date: '2026-01-26',
    dayOfWeek: 'Monday',
    type: 'gazetted',
    category: 'National',
    description: 'National holiday marking the adoption of the Constitution of India in 1950.',
    year: 2026,
    month: 1,
    isLongWeekend: true
  },
  {
    id: 'gh-2026-02',
    name: 'Id-ul-Fitr',
    hindiName: 'ईद-उल-फ़ित्र',
    date: '2026-03-21',
    dayOfWeek: 'Saturday',
    type: 'gazetted',
    category: 'Religious',
    description: 'Islamic festival marking the end of Ramadan, the holy month of fasting.',
    year: 2026,
    month: 3
  },
  {
    id: 'gh-2026-03',
    name: 'Holi',
    hindiName: 'होली',
    date: '2026-03-27',
    dayOfWeek: 'Friday',
    type: 'gazetted',
    category: 'Cultural',
    description: 'Ancient Hindu Festival of Colours celebrating spring, love, and the triumph of good over evil.',
    year: 2026,
    month: 3,
    isLongWeekend: true
  },
  {
    id: 'gh-2026-04',
    name: 'Good Friday',
    hindiName: 'गुड फ्राइडे',
    date: '2026-04-03',
    dayOfWeek: 'Friday',
    type: 'gazetted',
    category: 'Religious',
    description: 'Christian holiday commemorating the crucifixion of Jesus Christ at Calvary.',
    year: 2026,
    month: 4,
    isLongWeekend: true
  },
  {
    id: 'gh-2026-05',
    name: 'Dr. B.R. Ambedkar Jayanti',
    hindiName: 'डॉ. बी.आर. अम्बेडकर जयंती',
    date: '2026-04-14',
    dayOfWeek: 'Tuesday',
    type: 'gazetted',
    category: 'National',
    description: 'Birth anniversary of Dr. Bhimrao Ramji Ambedkar, father of the Indian Constitution.',
    year: 2026,
    month: 4
  },
  {
    id: 'gh-2026-06',
    name: 'Mahavir Jayanti',
    hindiName: 'महावीर जयंती',
    date: '2026-05-01',
    dayOfWeek: 'Friday',
    type: 'gazetted',
    category: 'Religious',
    description: 'Most important religious festival in Jainism celebrating the birth of Lord Mahavira.',
    year: 2026,
    month: 5,
    isLongWeekend: true
  },
  {
    id: 'gh-2026-07',
    name: 'Buddha Purnima',
    hindiName: 'बुद्ध पूर्णिमा',
    date: '2026-05-31',
    dayOfWeek: 'Sunday',
    type: 'gazetted',
    category: 'Religious',
    description: 'Festival commemorating the birth, enlightenment, and death of Gautama Buddha.',
    year: 2026,
    month: 5
  },
  {
    id: 'gh-2026-08',
    name: 'Bakrid / Id-ul-Zuha',
    hindiName: 'ईद-उल-जुहा (बकरीद)',
    date: '2026-05-28',
    dayOfWeek: 'Thursday',
    type: 'gazetted',
    category: 'Religious',
    description: 'Feast of the Sacrifice honoring the willingness of Ibrahim to sacrifice his son.',
    year: 2026,
    month: 5
  },
  {
    id: 'gh-2026-09',
    name: 'Muharram',
    hindiName: 'मुहर्रम',
    date: '2026-06-26',
    dayOfWeek: 'Friday',
    type: 'gazetted',
    category: 'Religious',
    description: 'The first month of the Islamic calendar; Ashura commemorates the martyrdom of Imam Hussain.',
    year: 2026,
    month: 6,
    isLongWeekend: true
  },
  {
    id: 'gh-2026-10',
    name: 'Independence Day',
    hindiName: 'स्वतंत्रता दिवस',
    date: '2026-08-15',
    dayOfWeek: 'Saturday',
    type: 'gazetted',
    category: 'National',
    description: 'National holiday marking the nation’s independence from British rule in 1947.',
    year: 2026,
    month: 8
  },
  {
    id: 'gh-2026-11',
    name: 'Milad-un-Nabi (Id-e-Milad)',
    hindiName: 'ईद-ए-मिलाद',
    date: '2026-08-26',
    dayOfWeek: 'Wednesday',
    type: 'gazetted',
    category: 'Religious',
    description: 'Observance of the birthday of the Islamic prophet Muhammad.',
    year: 2026,
    month: 8
  },
  {
    id: 'gh-2026-12',
    name: 'Mahatma Gandhi Birthday',
    hindiName: 'गांधी जयंती',
    date: '2026-10-02',
    dayOfWeek: 'Friday',
    type: 'gazetted',
    category: 'National',
    description: 'Birth anniversary of Mohandas Karamchand Gandhi, Father of the Nation.',
    year: 2026,
    month: 10,
    isLongWeekend: true
  },
  {
    id: 'gh-2026-13',
    name: 'Dussehra (Vijay Dashami)',
    hindiName: 'दशहरा (विजयदशमी)',
    date: '2026-10-20',
    dayOfWeek: 'Tuesday',
    type: 'gazetted',
    category: 'Cultural',
    description: 'Major Hindu festival celebrating the victory of Lord Rama over Ravana.',
    year: 2026,
    month: 10
  },
  {
    id: 'gh-2026-14',
    name: 'Diwali (Deepavali)',
    hindiName: 'दीपावली',
    date: '2026-11-08',
    dayOfWeek: 'Sunday',
    type: 'gazetted',
    category: 'Cultural',
    description: 'Hindu festival of lights symbolizing spiritual victory of light over darkness.',
    year: 2026,
    month: 11
  },
  {
    id: 'gh-2026-15',
    name: 'Guru Nanak Jayanti',
    hindiName: 'गुरु नानक जयंती',
    date: '2026-11-24',
    dayOfWeek: 'Tuesday',
    type: 'gazetted',
    category: 'Religious',
    description: 'Gurpurab celebrating the birth of the first Sikh Guru, Guru Nanak Dev Ji.',
    year: 2026,
    month: 11
  },
  {
    id: 'gh-2026-16',
    name: 'Christmas Day',
    hindiName: 'क्रिसमस',
    date: '2026-12-25',
    dayOfWeek: 'Friday',
    type: 'gazetted',
    category: 'Religious',
    description: 'Annual Christian festival celebrating the birth of Jesus Christ.',
    year: 2026,
    month: 12,
    isLongWeekend: true
  },
  {
    id: 'gh-2026-17',
    name: 'Uttarakhand State Foundation Day',
    hindiName: 'उत्तराखंड राज्य स्थापना दिवस',
    date: '2026-11-09',
    dayOfWeek: 'Monday',
    type: 'local',
    category: 'Institutional',
    description: 'Dehradun Institute / Regional holiday commemorating the formation of Uttarakhand state.',
    year: 2026,
    month: 11,
    isLongWeekend: true
  },

  // ================= 2026 Restricted Holidays (RH) =================
  {
    id: 'rh-2026-01',
    name: 'New Year’s Day',
    hindiName: 'नव वर्ष दिवस',
    date: '2026-01-01',
    dayOfWeek: 'Thursday',
    type: 'restricted',
    category: 'Cultural',
    description: 'First day of the Gregorian year.',
    year: 2026,
    month: 1
  },
  {
    id: 'rh-2026-02',
    name: 'Makar Sankranti / Pongal / Magha Bihu',
    hindiName: 'मकर संक्रांति / पोंगल',
    date: '2026-01-14',
    dayOfWeek: 'Wednesday',
    type: 'restricted',
    category: 'Cultural',
    description: 'Sun transition into Capricorn; harvest festival across Indian states.',
    year: 2026,
    month: 1
  },
  {
    id: 'rh-2026-03',
    name: 'Guru Ravidas Jayanti',
    hindiName: 'गुरु रविदास जयंती',
    date: '2026-02-02',
    dayOfWeek: 'Monday',
    type: 'restricted',
    category: 'Religious',
    description: 'Birthday of mystic poet-sant Ravidas.',
    year: 2026,
    month: 2
  },
  {
    id: 'rh-2026-04',
    name: 'Maha Shivratri',
    hindiName: 'महाशिवरात्रि',
    date: '2026-02-15',
    dayOfWeek: 'Sunday',
    type: 'restricted',
    category: 'Religious',
    description: 'Night of Lord Shiva, marked by prayer and devotion.',
    year: 2026,
    month: 2
  },
  {
    id: 'rh-2026-05',
    name: 'Holika Dahan',
    hindiName: 'होलिका दहन',
    date: '2026-03-26',
    dayOfWeek: 'Thursday',
    type: 'restricted',
    category: 'Cultural',
    description: 'Eve of Holi symbolizing bonfire burning of evil spirit Holika.',
    year: 2026,
    month: 3
  },
  {
    id: 'rh-2026-06',
    name: 'Easter Sunday',
    hindiName: 'ईस्टर संडे',
    date: '2026-04-05',
    dayOfWeek: 'Sunday',
    type: 'restricted',
    category: 'Religious',
    description: 'Christian festival celebrating the resurrection of Jesus Christ.',
    year: 2026,
    month: 4
  },
  {
    id: 'rh-2026-07',
    name: 'Vaisakhi / Vishu / Meshadi',
    hindiName: 'वैशाखी / विशु',
    date: '2026-04-14',
    dayOfWeek: 'Tuesday',
    type: 'restricted',
    category: 'Cultural',
    description: 'Solar new year and spring harvest festival in North/South India.',
    year: 2026,
    month: 4
  },
  {
    id: 'rh-2026-08',
    name: 'Guru Rabindranath Tagore Birthday',
    hindiName: 'रवींद्रनाथ टैगोर जयंती',
    date: '2026-05-09',
    dayOfWeek: 'Saturday',
    type: 'restricted',
    category: 'Cultural',
    description: 'Birth anniversary of Nobel Laureate Rabindranath Tagore.',
    year: 2026,
    month: 5
  },
  {
    id: 'rh-2026-09',
    name: 'Rath Yatra',
    hindiName: 'रथ यात्रा',
    date: '2026-07-16',
    dayOfWeek: 'Thursday',
    type: 'restricted',
    category: 'Religious',
    description: 'Chariot procession festival of Lord Jagannath.',
    year: 2026,
    month: 7
  },
  {
    id: 'rh-2026-10',
    name: 'Raksha Bandhan',
    hindiName: 'रक्षा बंधन',
    date: '2026-08-28',
    dayOfWeek: 'Friday',
    type: 'restricted',
    category: 'Cultural',
    description: 'Sacred bond and protection festival between brothers and sisters.',
    year: 2026,
    month: 8,
    isLongWeekend: true
  },
  {
    id: 'rh-2026-11',
    name: 'Janmashtami (Smarta)',
    hindiName: 'श्री कृष्ण जन्माष्टमी',
    date: '2026-09-04',
    dayOfWeek: 'Friday',
    type: 'restricted',
    category: 'Religious',
    description: 'Celebration of the birth of Lord Krishna, eighth avatar of Vishnu.',
    year: 2026,
    month: 9,
    isLongWeekend: true
  },
  {
    id: 'rh-2026-12',
    name: 'Ganesh Chaturthi',
    hindiName: 'गणेश चतुर्थी',
    date: '2026-09-14',
    dayOfWeek: 'Monday',
    type: 'restricted',
    category: 'Religious',
    description: 'Arrival of Lord Ganesha to Earth, celebrating wisdom and prosperity.',
    year: 2026,
    month: 9,
    isLongWeekend: true
  },
  {
    id: 'rh-2026-13',
    name: 'Maha Ashtami / Maha Navami',
    hindiName: 'महाअष्टमी / महानवमी',
    date: '2026-10-19',
    dayOfWeek: 'Monday',
    type: 'restricted',
    category: 'Religious',
    description: 'Durga Puja main celebration days.',
    year: 2026,
    month: 10,
    isLongWeekend: true
  },
  {
    id: 'rh-2026-14',
    name: 'Karwa Chauth',
    hindiName: 'करवा चौथ',
    date: '2026-10-29',
    dayOfWeek: 'Thursday',
    type: 'restricted',
    category: 'Cultural',
    description: 'Fasting day observed by married women for longevity and safety of spouses.',
    year: 2026,
    month: 10
  },
  {
    id: 'rh-2026-15',
    name: 'Govardhan Puja',
    hindiName: 'गोवर्धन पूजा',
    date: '2026-11-09',
    dayOfWeek: 'Monday',
    type: 'restricted',
    category: 'Religious',
    description: 'Annakut festival commemorating Krishna lifting Govardhan hill.',
    year: 2026,
    month: 11
  },
  {
    id: 'rh-2026-16',
    name: 'Bhai Duj',
    hindiName: 'भाई दूज',
    date: '2026-11-10',
    dayOfWeek: 'Tuesday',
    type: 'restricted',
    category: 'Cultural',
    description: 'Celebration of fraternal bond following Diwali festivities.',
    year: 2026,
    month: 11
  },
  {
    id: 'rh-2026-17',
    name: 'Chhath Puja',
    hindiName: 'छठ पूजा (सूर्य षष्ठी)',
    date: '2026-11-15',
    dayOfWeek: 'Sunday',
    type: 'restricted',
    category: 'Cultural',
    description: 'Ancient Vedic festival dedicated to the Sun God Surya and Chhathi Maiya.',
    year: 2026,
    month: 11
  },
  {
    id: 'rh-2026-18',
    name: 'Christmas Eve',
    hindiName: 'क्रिसमस संध्या',
    date: '2026-12-24',
    dayOfWeek: 'Thursday',
    type: 'restricted',
    category: 'Religious',
    description: 'Evening before Christmas Day.',
    year: 2026,
    month: 12
  }
];

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];
