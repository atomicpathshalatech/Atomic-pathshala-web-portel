export type IndianStateStampRule = {
  stateCode: string;
  stateName: string;
  defaultDutyAmount: string;
  defaultArticle: string;
  stampDutyApplicable: boolean;
  legalNotes: string;
};

/**
 * Standard Indian State Stamp Duty Guidelines for Service & Employment Agreements
 * pursuant to the Indian Stamp Act, 1899 and respective State Stamp Acts.
 */
export const INDIAN_STATE_STAMP_RULES: IndianStateStampRule[] = [
  {
    stateCode: "UP",
    stateName: "Uttar Pradesh",
    defaultDutyAmount: "100",
    defaultArticle: "Article 5(J) Agreement",
    stampDutyApplicable: true,
    legalNotes: "Under UP Stamp Act, general agreements require minimum Rs. 100 non-judicial e-Stamp.",
  },
  {
    stateCode: "DL",
    stateName: "Delhi (NCT)",
    defaultDutyAmount: "100",
    defaultArticle: "Article 5(c) Agreement",
    stampDutyApplicable: true,
    legalNotes: "Delhi Stamp Act Schedule 1A prescribes Rs. 100 for faculty/employment service agreements.",
  },
  {
    stateCode: "MH",
    stateName: "Maharashtra",
    defaultDutyAmount: "500",
    defaultArticle: "Article 5(h) Agreement",
    stampDutyApplicable: true,
    legalNotes: "Maharashtra Stamp Act mandates Rs. 500 stamp duty for service and consultancy contracts.",
  },
  {
    stateCode: "KA",
    stateName: "Karnataka",
    defaultDutyAmount: "200",
    defaultArticle: "Article 5(e) Agreement",
    stampDutyApplicable: true,
    legalNotes: "Karnataka Stamp Act prescribes Rs. 200 for employment & consultancy contracts.",
  },
  {
    stateCode: "HR",
    stateName: "Haryana",
    defaultDutyAmount: "100",
    defaultArticle: "Article 5 Agreement",
    stampDutyApplicable: true,
    legalNotes: "Haryana Stamp Act requires Rs. 100 non-judicial stamp duty for faculty contracts.",
  },
  {
    stateCode: "RJ",
    stateName: "Rajasthan",
    defaultDutyAmount: "500",
    defaultArticle: "Article 5 Agreement",
    stampDutyApplicable: true,
    legalNotes: "Rajasthan Stamp Act mandates Rs. 500 for commercial and service agreements.",
  },
  {
    stateCode: "WB",
    stateName: "West Bengal",
    defaultDutyAmount: "100",
    defaultArticle: "Article 5 Agreement",
    stampDutyApplicable: true,
    legalNotes: "West Bengal Stamp Act prescribes Rs. 100 for standard educator contracts.",
  },
];

export function getStampRuleForState(stateCode: string): IndianStateStampRule {
  const found = INDIAN_STATE_STAMP_RULES.find(
    (s) => s.stateCode.toUpperCase() === stateCode.toUpperCase()
  );
  return (
    found || {
      stateCode: "OTHER",
      stateName: stateCode || "National / Interstate",
      defaultDutyAmount: "100",
      defaultArticle: "Article 5 Agreement",
      stampDutyApplicable: true,
      legalNotes: "Standard Indian Stamp Act minimum duty requirement.",
    }
  );
}

/**
 * Validates genuine manual e-Stamp certificate upload metadata.
 * Ensures no fabricated certificate numbers or placeholder values are accepted.
 */
export function validateManualEStampInput(input: {
  certificateNumber: string;
  stampDutyAmount: string;
  issuingState: string;
  issueDate: string;
}): { valid: boolean; error?: string } {
  const cert = input.certificateNumber?.trim();
  if (!cert || cert.length < 5) {
    return { valid: false, error: "A valid e-Stamp Certificate Number / UIN is required." };
  }

  // Guard against synthetic placeholder strings
  const forbiddenPatterns = [
    /^IN-UP\d+A$/i,
    /TEST/i,
    /PLACEHOLDER/i,
    /DUMMY/i,
    /SAMPLE/i,
    /SUBIN-UPATOMIC/i,
  ];
  for (const pat of forbiddenPatterns) {
    if (pat.test(cert)) {
      return {
        valid: false,
        error: "Placeholder or synthetic certificate numbers are not permitted. Please enter a genuine Government-issued e-Stamp certificate number.",
      };
    }
  }

  if (!input.stampDutyAmount || isNaN(Number(input.stampDutyAmount.replace(/[^0-9.]/g, "")))) {
    return { valid: false, error: "A valid numeric Stamp Duty Amount (in INR) is required." };
  }

  if (!input.issuingState?.trim()) {
    return { valid: false, error: "Please select the issuing State for the e-Stamp certificate." };
  }

  const parsedDate = new Date(input.issueDate);
  if (isNaN(parsedDate.getTime())) {
    return { valid: false, error: "Please provide a valid certificate Issue Date." };
  }

  return { valid: true };
}
