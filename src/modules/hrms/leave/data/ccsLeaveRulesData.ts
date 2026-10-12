export interface LeaveRuleCategory {
  title: string;
  description: string;
  rules: {
    ruleNo?: string;
    name: string;
    debited: boolean;
    entitlement: string;
    keyPoints: string[];
  }[];
}

export const CCS_LEAVE_RULES_SUMMARY = [
  {
    category: "Regular Leaves (Debited from Leave Account)",
    items: [
      {
        name: "Earned Leave (EL)",
        rule: "Rule 26",
        debited: true,
        summary: "15 days advance credit on 1st Jan & 1st July each year. Max accumulation: 300+15 days. Max sanction at one time: 180 days (300 days for Group A/B spending outside India).",
        details: [
          "Credited @ 2.5 days per completed calendar month for new appointment, retirement, or resignation.",
          "EOL/Dies-non period reduces credit by 1/10th in subsequent half-year.",
          "Leave salary = Pay drawn immediately before proceeding on EL."
        ]
      },
      {
        name: "Half Pay Leave (HPL)",
        rule: "Rule 29",
        debited: true,
        summary: "10 days advance credit on 1st Jan & 1st July. Credited @ 5/3 days per completed month.",
        details: [
          "Leave salary = Half of pay drawn + full HRA & CCA.",
          "Deduction for dies-non @ 1/18th of absence period."
        ]
      },
      {
        name: "Commuted Leave",
        rule: "Rule 30",
        debited: true,
        summary: "Granted on Medical Certificate (MC). Max 90 days without MC in entire service for approved study or female employee post-maternity.",
        details: [
          "Twice the amount of commuted leave is debited from HPL account.",
          "Leave salary = Same as admissible during Earned Leave."
        ]
      },
      {
        name: "Leave Not Due (LND)",
        rule: "Rule 31",
        debited: true,
        summary: "Maximum 360 days in entire service career on Medical Certificate for permanent employees.",
        details: [
          "Debited against future HPL to be earned.",
          "No medical certificate required in continuation of Maternity Leave."
        ]
      },
      {
        name: "Extra Ordinary Leave (EOL)",
        rule: "Rule 32",
        debited: true,
        summary: "Granted when no other leave is admissible or employee applies in writing. Leave salary is NIL.",
        details: [
          "Permanent employees: Up to 5 years continuous absence limit.",
          "Temporary employees: 3 months (6 months with MC after 1 yr service; 18 months for TB/Cancer/Leprosy treatment; 24 months for higher studies after 3 yrs service)."
        ]
      }
    ]
  },
  {
    category: "Casual & Short Absences (Not Regular CCS Leave)",
    items: [
      {
        name: "Casual Leave (CL)",
        rule: "Executive Orders",
        debited: false,
        summary: "8 days per year for normal employees, 12 days for differently-abled employees. Can be availed for half-day.",
        details: [
          "Is not a regular leave and cannot be combined with regular leave ordinarily."
        ]
      },
      {
        name: "Restricted Holidays (RH)",
        rule: "Executive Orders",
        debited: false,
        summary: "Maximum 2 RH in a calendar year from government-approved list.",
        details: [
          "Requires prior approval of competent authority."
        ]
      },
      {
        name: "Compensatory Off (C-Off)",
        rule: "Executive Orders",
        debited: false,
        summary: "Granted for working on holidays if no OTA/Honorarium was received.",
        details: [
          "Should normally be availed within 1 month. Max 2 c-offs in subsequent month with special permission."
        ]
      },
      {
        name: "Special Casual Leave",
        rule: "Executive Orders",
        debited: false,
        summary: "Granted for National Sports/Cultural events, Family Planning, Natural Calamities, Bandh, etc.",
        details: [
          "Can be combined with CL or RH, but not with both."
        ]
      }
    ]
  },
  {
    category: "Special Kinds of Leave (NOT Debited from Leave Account)",
    items: [
      {
        name: "Maternity Leave",
        rule: "Rule 43",
        debited: false,
        summary: "180 days for child birth/adoption (child < 1 yr) for female employees with < 2 surviving children.",
        details: [
          "Additional 45 days available for abortion/miscarriage once in service career on MC.",
          "Can be combined with other leave up to 2 years without MC."
        ]
      },
      {
        name: "Child Care Leave (CCL)",
        rule: "Rule 43-C",
        debited: false,
        summary: "730 days (2 years) during entire service for female employees for up to 2 eldest surviving children below 18 years (no age limit for disabled children).",
        details: [
          "Max 3 spells allowed per calendar year (6 spells for single mother).",
          "Treated like EL; Saturdays/Sundays/Holidays during leave count as CCL."
        ]
      },
      {
        name: "Paternity Leave",
        rule: "Rule 43-A",
        debited: false,
        summary: "15 days for male employees during wife's confinement (15 days before to 6 months after delivery) or adoption of child < 1 yr.",
        details: [
          "Available for < 2 surviving children. If not availed within 6 months, it lapses."
        ]
      },
      {
        name: "Study Leave",
        rule: "Rule 50",
        debited: false,
        summary: "Ordinarily 12 months at one time & 24 months total in service career (36 months for Central Health Services).",
        details: [
          "Eligible after 5 years continuous service and completion of probation.",
          "Requires executing a 3-year service bond."
        ]
      }
    ]
  },
  {
    category: "General Rules & Conditions",
    items: [
      {
        name: "Rule 7(1): Right to Leave",
        rule: "Rule 7",
        debited: false,
        summary: "Leave cannot be claimed as a matter of right. Leave may be refused, curtailed, or revoked in public interest.",
        details: []
      },
      {
        name: "Rule 12(2): Continuous Absence Limit",
        rule: "Rule 12",
        debited: false,
        summary: "Continuous absence of any kind exceeding 5 years leads to deemed resignation unless approved by the President.",
        details: []
      },
      {
        name: "Rule 39: Leave Encashment",
        rule: "Rule 39",
        debited: false,
        summary: "Max 300 days EL/HPL combined encashment upon superannuation/retirement. Max 10 days EL encashment per LTC instance (up to 60 days career aggregate).",
        details: []
      }
    ]
  }
];
