import { NextResponse } from "next/server";

/**
 * 4. FUTURE-PROOF CONFIGURATION:
 * BASE_GATEWAY_URL points to our local mock route right now.
 * To switch to the official government NHA ABDM Gateway when Client ID keys arrive,
 * update this variable to:
 * const BASE_GATEWAY_URL = 'https://abdm.gov.in';
 */
const BASE_GATEWAY_URL = "http://localhost:3000/api/validate-abha";

// 2. DATA STRUCTURE (The Mock Registry):
const mockRegistry = [
  {
    abhaNumber: "11223344556677",
    abhaAddress: "alex@sbx",
    name: "Alex Johnson",
    age: 32,
    gender: "male",
    status: "ACTIVE",
  },
  {
    abhaNumber: "99887766554433",
    abhaAddress: "priya@sbx",
    name: "Priya Sharma",
    age: 28,
    gender: "female",
    status: "ACTIVE",
  },
  {
    abhaNumber: "55555555555555",
    abhaAddress: "test@sbx",
    name: "Test User",
    age: 40,
    gender: "male",
    status: "SUSPENDED",
  },

  // REAL USER DETAILS WITH FULL NAME:
  {
    abhaNumber: "91786767244217",
    abhaAddress: "navaneethanrs_18@abdm",
    name: "Navaneethan R S",
    age: 24,
    gender: "male",
    status: "ACTIVE",
  },
];

// 3. BACKEND VALIDATION ENDPOINT
export async function POST(request) {
  try {
    let body = {};
    try {
      const text = await request.text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = { input: text };
        }
      }
    } catch (e) {
      body = {};
    }

    const rawInput = body.input || body.abhaId || body.abhaNumber || body.abhaAddress || "";

    if (!rawInput || typeof rawInput !== "string") {
      return NextResponse.json(
        { valid: false, message: "Please enter a valid ABHA Number or Address" },
        { status: 400 }
      );
    }

    // Clean the input: Automatically strip out hyphens and empty spaces
    const cleanedInput = rawInput.replace(/[-\s]/g, "").trim().toLowerCase();

    // Routing logic: Check if cleaned input matches mock 14-digit Number OR text-based Address
    const matchedProfile = mockRegistry.find((profile) => {
      const cleanNum = profile.abhaNumber.replace(/[-\s]/g, "").trim().toLowerCase();
      const cleanAddr = profile.abhaAddress.trim().toLowerCase();
      return cleanedInput === cleanNum || cleanedInput === cleanAddr;
    });

    if (matchedProfile) {
      if (matchedProfile.status === "ACTIVE") {
        return NextResponse.json(
          {
            valid: true,
            message: "Valid Original Card Checked",
            profile: {
              abhaNumber: matchedProfile.abhaNumber,
              abhaAddress: matchedProfile.abhaAddress,
              name: matchedProfile.name,
              age: matchedProfile.age,
              gender: matchedProfile.gender,
              status: matchedProfile.status,
            },
          },
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          {
            valid: false,
            message: `ABHA Card status is ${matchedProfile.status}`,
          },
          { status: 400 }
        );
      }
    }

    // If input doesn't exist in mock array, return HTTP 404 lookup failure
    return NextResponse.json(
      {
        valid: false,
        message: "Invalid ABHA ID or Address. Lookup failed.",
      },
      { status: 404 }
    );
  } catch (error) {
    return NextResponse.json(
      { valid: false, message: "Server error: " + error.message },
      { status: 500 }
    );
  }
}
