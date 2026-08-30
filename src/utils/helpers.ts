import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import { customAlphabet } from "nanoid/non-secure";

dayjs.extend(advancedFormat);

export function formatCurrency(amount: number, dec: number = 0) {
	return "₦" + Number(amount)
		.toFixed(dec)
		.replace(/\B(?=(\d{3})+(?!\d))/g, ",") || "0";
}

export function formatShortCurrency(amount: number): string {
	if (amount >= 1_000_000) {
		return `₦${(amount / 1_000_000).toFixed(1)}M`;
	}
	if (amount >= 1_000) {
		return `₦${(amount / 1_000).toFixed(0)}k`;
	}
	return `₦${amount}`;
}

export function formatNumber(amount: number) {
	return amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",") || "0";
}

export function generateSlug(num=10) {
  const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', num);
  return nanoid();
};

export function truncateString(input: string, num:number = 25): string {
	if (input?.length > num) {
		return input?.substring(0, num) + "...";
	} else {
		return input;
	}
}

export function calculatePercentage(current: number, target: number): number {
	if (target === 0) return 0;
	const percentage = (current / target) * 100;
	return percentage >= 100 ? 100 : Number(percentage.toFixed(percentage % 1 === 0 ? 0 : 1));
}

export function formatDateFull(dateString: string): string {
	return dayjs(dateString).format('Do, MMM YYYY [at] hh:mm a');
}


export function formatDate(dateString: string): string {
	const target = dayjs(dateString);
	const now = dayjs();

	const minutesAgo = now.diff(target, 'minute');
	const hoursAgo = now.diff(target, 'hour');
	const daysAgo = now.diff(target, 'day');
	const weeksAgo = now.diff(target, 'week');
	const monthsAgo = now.diff(target, 'month');
	const yearsAgo = now.diff(target, 'year');

	if (minutesAgo < 1) {
		return 'Just now';
	} else if (minutesAgo < 60) {
		return `${minutesAgo} min${minutesAgo > 1 ? 's' : ''} ago`;
	} else if (hoursAgo < 24) {
		return `${hoursAgo} hr${hoursAgo > 1 ? 's' : ''} ago`;
	} else if (daysAgo === 1) {
		return 'Yesterday';
	} else if (daysAgo < 7) {
		return `Last ${target.format('ddd')}`; // Last Tue
	} else if (weeksAgo < 4) {
		return `${weeksAgo} week${weeksAgo > 1 ? 's' : ''} ago`;
	} else if (monthsAgo < 12) {
		return `${monthsAgo} month${monthsAgo > 1 ? 's' : ''} ago`;
	} else {
		return `${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago`;
	}
}


export const calculateTimeLeft = (targetTime: any) => {
	const now = dayjs();
	const target = dayjs(targetTime);

	const timeLeft = target.diff(now);

	if (timeLeft <= 0) {
		return {
			days: 0,
			hours: '00',
			minutes: '00',
			seconds: '00',
		};
	}

	const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
	const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
	const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

	return {
		days,
		hours: hours.toString().padStart(2, '0'),
		minutes: minutes.toString().padStart(2, '0'),
		seconds: seconds.toString().padStart(2, '0'),
	};
};


export const paystackTransferFee = function(amount: number) {
	if (!amount) return 0
	if (amount <= 5000) return 10;
	if (amount <= 50000) return 25;
	return 50;
}

export const getProfileImage = function(file: any) {
	if (file && typeof file === "string") return file;
	if (file && typeof file === "object") return file?.uri;

	return require("../../assets/defaultAvatar.png");
}

export const getFilePath = function(file: any) {
	if (file && typeof file === "string") return file;
	if (file && typeof file === "object") return file?.uri;

	return null;
}
