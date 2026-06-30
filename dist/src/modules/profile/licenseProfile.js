export function canMeetDriverRequirement(settings, required, categories = [], ownVehicle = false) {
    if (!required && !ownVehicle)
        return true;
    if (ownVehicle && !settings.profile.driverLicense.hasOwnVehicle)
        return false;
    if (required && !settings.profile.driverLicense.hasLicense)
        return false;
    if (categories.length === 0)
        return true;
    return categories.some((category) => settings.profile.driverLicense.categories.includes(category));
}
