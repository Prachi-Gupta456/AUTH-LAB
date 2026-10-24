import {UAParser} from "ua-parser-js";

export const parseDevice = (userAgent = '') => {
    const result = new UAParser(userAgent).getResult();

    return {
        browser: result.browser.name || "Unknown browser",
        os: result.os.name || "Unknown OS",
        // UAParser returns undefined for desktops, so default to 'desktop'
        deviceType: result.device.type || 'desktop',
    };
};