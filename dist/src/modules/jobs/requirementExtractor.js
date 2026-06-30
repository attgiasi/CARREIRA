import { detectEducationRequirement } from "./educationRequirementDetector.js";
import { detectDriverLicense } from "./driverLicenseDetector.js";
import { detectSeniority } from "./seniorityDetector.js";
import { detectWorkStyle, detectsTravel } from "./workStyleDetector.js";
import { extractSalary } from "./salaryExtractor.js";
export function extractRequirements(text) {
    const education = detectEducationRequirement(text);
    const license = detectDriverLicense(text);
    return {
        workModel: detectWorkStyle(text),
        travelRequired: detectsTravel(text),
        driverLicenseRequired: license.required,
        driverLicenseCategories: license.categories,
        ownVehicleRequired: license.ownVehicle,
        educationRequired: education.label,
        educationLevelDetected: education.level,
        seniorityLevel: detectSeniority(text),
        salary: extractSalary(text)
    };
}
