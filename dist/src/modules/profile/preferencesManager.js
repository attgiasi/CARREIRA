export function targetRoles(settings) {
    const prefs = settings.jobSearchPreferences;
    return prefs.targetRoles ?? [];
}
export function acceptsCareerLevel(settings, level) {
    const prefs = settings.jobSearchPreferences;
    return prefs.careerLevels?.[level] ?? true;
}
