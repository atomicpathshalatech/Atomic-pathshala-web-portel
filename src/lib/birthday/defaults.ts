import type { BirthdayCategory } from "@prisma/client";

// NOTE: no "server-only" import — this is pure data, imported by
// prisma/seed.ts (a plain Node script), same reasoning as lib/email/defaults.ts.

export type DefaultBirthdayTemplate = {
  name: string;
  category: BirthdayCategory;
  messageText: string;
};

/**
 * Editable after seeding (see BirthdayTemplate + /team/communication/birthday
 * — Admin Template Manager). [Student Name] / [Institute Name] are replaced
 * in lib/birthday/send.ts; this is the exact wording supplied in the spec.
 */
export const DEFAULT_BIRTHDAY_TEMPLATES: DefaultBirthdayTemplate[] = [
  {
    name: "General Student",
    category: "GENERAL",
    messageText: `🎂✨ Happy Birthday, [Student Name]! ✨🎂

आज का दिन सिर्फ आपके जन्मदिन का नहीं, बल्कि आपके सपनों को एक और साल करीब लाने का दिन है। 🌟

हमारी पूरी [Institute Name] Team की तरफ से आपको ढेरों शुभकामनाएँ। 💐

हम चाहते हैं कि आने वाला साल आपके लिए नई सीख, नई उपलब्धियाँ और बहुत सारी खुशियाँ लेकर आए।

आपकी मेहनत आपको हर उस मुकाम तक पहुँचाए जिसके लिए आपने सपना देखा है। 💪🔥

Keep Learning. Keep Growing. Keep Achieving.

🎉 Once Again, Happy Birthday, [Student Name]! 🎂❤️

— [Institute Name] Team`,
  },
  {
    name: "Staff Birthday",
    category: "GENERAL",
    messageText: `🎂✨ Happy Birthday, [Student Name]! ✨🎂

आज का दिन आपके योगदान और आपकी मेहनत को सेलिब्रेट करने का दिन है।

हमारी पूरी [Institute Name] Team की तरफ से आपको ढेरों शुभकामनाएँ। 💐

आने वाला साल आपके लिए सेहत, खुशियों और नई उपलब्धियों से भरा रहे।

🎉 Happy Birthday! 🎂❤️

— [Institute Name] Team`,
  },
  {
    name: "Class 9 / Foundation",
    category: "FOUNDATION9",
    messageText: `🎂🌟 Happy Birthday, [Student Name]! 🌟🎂

आपकी academic journey का यह शुरुआती पड़ाव है और यही समय आपके मजबूत foundation की नींव रखने का है। 📚

हमारी शुभकामना है कि आपका आने वाला साल knowledge, confidence और नई achievements से भरा रहे। 🚀

आज खूब enjoy कीजिए, लेकिन अपने बड़े सपनों को कभी मत भूलिए।

क्योंकि आज का छोटा-सा effort ही कल की बड़ी सफलता बनता है। 💯

Dream Big. Build Strong. Keep Growing.

🎉 Happy Birthday, [Student Name]! 🎂

आपकी [Institute Name] Team की तरफ से ढेरों शुभकामनाएँ। ❤️`,
  },
  {
    name: "Class 10 / Board",
    category: "CLASS10",
    messageText: `🎂📚 Happy Birthday, [Student Name]! 📚🎂

Class 10 की journey आपके academic life का एक महत्वपूर्ण पड़ाव है।

इस साल आपकी मेहनत, consistency और determination आपके आने वाले रास्ते को और मजबूत बनाएगी। 💯

हमारी शुभकामना है कि आप अपने Board Exams में शानदार प्रदर्शन करें और अपने हर लक्ष्य को achieve करें। 🏆

Birthday पर थोड़ा celebration तो बनता है! 🎉

लेकिन अगले दिन फिर से books आपका इंतज़ार कर रही हैं। 😄📚

Stay Focused. Stay Consistent. Make Yourself Proud.

🎂 Happy Birthday, [Student Name]!

— [Institute Name] Team`,
  },
  {
    name: "Class 11",
    category: "CLASS11",
    messageText: `🎂🔥 Happy Birthday, [Student Name]! 🔥🎂

Class 11 सिर्फ एक नई class नहीं है, बल्कि आपकी आगे की academic journey का foundation है। 📚

इस नए साल में आपकी मेहनत और consistency आपको आपके goals के और करीब लेकर जाए। 🚀

आज अपने Birthday को खुलकर celebrate कीजिए, खूब खुश रहिए और नई energy के साथ अपनी पढ़ाई पर वापस लौटिए। 💪

याद रखिए—

बड़ी सफलता एक दिन में नहीं मिलती, लेकिन हर दिन की छोटी मेहनत उसे जरूर करीब लाती है।

🎉 Happy Birthday, [Student Name]! 🎂

Wishing you a year full of Growth, Success & New Achievements!`,
  },
  {
    name: "Class 12",
    category: "CLASS12",
    messageText: `🎂🏆 Happy Birthday, [Student Name]! 🏆🎂

Class 12 का यह साल आपकी academic journey के सबसे महत्वपूर्ण वर्षों में से एक है।

आपकी मेहनत, discipline और consistency ही आपको आपके desired goal तक पहुँचाएगी। 📚🔥

हमारी पूरी team की शुभकामना है कि आप अपने Board Exams और future goals में शानदार सफलता प्राप्त करें। 💯

आज Birthday है, इसलिए celebration जरूरी है! 🎉

लेकिन याद रखिए—

आपका सबसे बड़ा celebration उस दिन होगा जब आपकी मेहनत का result आपके सामने होगा। ❤️

Keep working hard. Keep believing in yourself.

🎂 Happy Birthday, [Student Name]!

— [Institute Name] Team`,
  },
  {
    name: "NEET",
    category: "NEET",
    messageText: `🎂🩺 Happy Birthday, [Student Name]! 🩺🎂

एक NEET aspirant के लिए हर दिन एक नए लक्ष्य की तरफ बढ़ने का दिन है।

आज आपके Birthday पर हमारी यही wish है कि आपका आने वाला साल आपकी preparation और आपकी जिंदगी—दोनों में नई सफलता लेकर आए। ❤️

आपकी मेहनत रंग लाए, आपकी concepts और मजबूत हों, आपके tests में scores बेहतर हों और आपका confidence हर दिन बढ़ता जाए। 📚🔥

आज थोड़ा celebration कीजिए, cake enjoy कीजिए 🎂😄 और फिर उसी determination के साथ अपने dream "Doctor बनने" की journey जारी रखिए। 🩺✨

One Goal. One Dream. One Day at a Time.

🎉 Happy Birthday, [Student Name]!

May this year bring you closer to the NEET success you are working for. 💯🩺

— [Institute Name] Team`,
  },
  {
    name: "JEE",
    category: "JEE",
    messageText: `🎂⚡ Happy Birthday, [Student Name]! ⚡🎂

JEE preparation सिर्फ books और formulas की journey नहीं है—यह discipline, patience, consistency और determination की journey है। 📚🔥

आज आपके Birthday पर हमारी शुभकामना है कि आने वाला साल आपके लिए better concepts, better performance और बड़ी achievements लेकर आए। 🚀

Problems कितनी भी tough हों, उन्हें solve करने का confidence हमेशा बना रहे। 💪

आज Birthday है—तो थोड़ी देर formulas को break दीजिए! 😄🎂

लेकिन कल फिर उसी Focus + Practice + Consistency के साथ वापस आ जाइए।

🎉 Happy Birthday, [Student Name]!

Keep solving. Keep improving. Keep moving towards your dream. ⚡🏆

— [Institute Name] Team`,
  },
];
