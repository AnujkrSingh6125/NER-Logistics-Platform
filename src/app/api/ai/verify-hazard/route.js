import { GoogleGenAI, Type } from '@google/genai';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const apiKey = 
      process.env.GEMINI_API_KEY || 
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'GEMINI_API_KEY is not configured on the server. Please add GEMINI_API_KEY in your Vercel Environment Variables.' 
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const body = await req.json();
    const { 
      mediaUrls = [], 
      mediaBase64List = [], 
      declaredHazardType = 'landslide', 
      declaredSeverity = 'high', 
      description = '',
      state = 'Assam',
      district = '' 
    } = body;

    const parts = [];

    // 1. Process direct Base64 items if provided
    if (mediaBase64List && mediaBase64List.length > 0) {
      for (const item of mediaBase64List.slice(0, 3)) {
        if (item.data && item.mimeType) {
          parts.push({
            inlineData: {
              data: item.data.replace(/^data:[^;]+;base64,/, ''),
              mimeType: item.mimeType,
            },
          });
        }
      }
    }

    // 2. Fetch and convert media URLs if provided
    if (parts.length === 0 && mediaUrls && mediaUrls.length > 0) {
      for (const url of mediaUrls.slice(0, 3)) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const buffer = await res.arrayBuffer();
            const contentType = res.headers.get('content-type') || 'image/jpeg';
            parts.push({
              inlineData: {
                data: Buffer.from(buffer).toString('base64'),
                mimeType: contentType,
              },
            });
          }
        } catch (fetchErr) {
          console.warn('Failed to fetch media URL for Gemini:', url, fetchErr);
        }
      }
    }

    // If no media attached, return a bypass or requirement error
    if (parts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No image or video media was provided for AI verification.',
      }, { status: 400 });
    }

    const promptText = `
      You are the Chief Disaster Logistics Forensic AI for the North-Eastern Region (NER) Disaster Management Authorities (NDMA/SDMA India).
      
      Your mission is to inspect BOTH the provided image(s)/video frame(s) AND the operator's text description to verify whether this is an AUTHENTIC and VALID road disaster report.
      
      REPORT METADATA:
      - Declared Hazard Type: ${declaredHazardType}
      - Declared Severity Level: ${declaredSeverity}
      - Operator Description: "${description}"
      - Geographical Location: ${district ? `${district}, ` : ''}${state} (North-Eastern India)

      FORENSIC EVALUATION CRITERIA:
      1. DESCRIPTION MEANINGFULNESS & CONTEXT:
         - The description must be a coherent, meaningful explanation providing context about the road condition, disaster impact, blockage details, weather, route warning, or clearance efforts.
         - REJECT (is_description_valid MUST be false) if the description is:
           * Random keyboard mash or gibberish (e.g. "sdDSFZCZXC", "asdfghjkl", "qwertyuiop", "12345678", "zzzzzz")
           * Meaningless placeholder words, single characters, or repetitive spam (e.g. "test test test", "blah blah", "aaa", "xyz abc")
           * Completely unrelated topics with zero road hazard context (e.g. food recipes, greetings, jokes, song lyrics, casual chat)
           * Incoherent text that fails to explain the situation or hazard
      
      2. VISUAL MEDIA EVIDENCE CRITERIA:
         - Must have visual evidence of a physical road obstruction or transit disaster: mountain landslide, rockfall, mudslide, flash flood, road collapse / cave-in / washout, bridge failure, fallen trees on road, or severe waterlogging blocking transit.
         - REJECT (is_real_hazard MUST be false and detected_hazard_type MUST be 'none_or_fake') if the media is:
           * Digital screen captures or screenshots (Zoom, Meet, Teams, Google Maps, code, documents, slide decks, timetables)
           * Indoor/domestic scenes (rooms, offices, walls, floors, selfies)
           * Unrelated outdoor subjects (clean roads with normal traffic, animals, sports, selfies)
           * Cartoons, memes, clipart, AI synthetic art
      
      3. REJECTION EXPLANATION:
         - If either the media is not a real hazard OR the description is meaningless/gibberish/unrelated:
           * The overall report MUST BE REJECTED.
           * Provide a clear, polite, user-facing reason in rejection_reason detailing specifically what was invalid (e.g. "The field description ('${description.slice(0, 30)}') is random keyboard gibberish. Please provide a meaningful explanation of the road situation and clearance status." or "The uploaded media is a screenshot rather than authentic road hazard evidence.").
    `;

    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.8-flash',
    ];

    let lastError = null;
    let responseText = null;

    const schemaConfig = {
      type: Type.OBJECT,
      properties: {
        is_real_hazard: { 
          type: Type.BOOLEAN, 
          description: 'True if visual evidence shows an authentic physical road disaster or obstruction; false if screenshot, document, indoor, meme, fake, clean road, or unrelated.' 
        },
        is_description_valid: {
          type: Type.BOOLEAN,
          description: 'True if the operator description is coherent and provides meaningful context about the road hazard or clearance; false if gibberish (e.g. sdDSFZCZXC), keyboard spam, filler, or unrelated.'
        },
        authenticity_confidence: { 
          type: Type.NUMBER, 
          description: 'Confidence score between 0.00 and 1.00.' 
        },
        detected_hazard_type: { 
          type: Type.STRING, 
          enum: ['landslide', 'flash_flood', 'road_washout', 'tree_fall', 'heavy_waterlogging', 'bridge_damage', 'other', 'none_or_fake'] 
        },
        verified_severity: { 
          type: Type.STRING, 
          enum: ['critical', 'high', 'medium', 'low', 'unaffected'] 
        },
        road_blockage_percentage: { 
          type: Type.INTEGER, 
          description: 'Estimated road blockage from 0 to 100 percent.' 
        },
        rejection_reason: { 
          type: Type.STRING, 
          description: 'Detailed explanation if is_real_hazard is false OR is_description_valid is false; null if completely verified.' 
        },
        verdict_summary: { 
          type: Type.STRING, 
          description: '1-2 concise sentences summarizing the forensic findings.' 
        },
        flagged_concerns: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING } 
        },
      },
      required: [
        'is_real_hazard', 
        'is_description_valid',
        'authenticity_confidence', 
        'detected_hazard_type', 
        'verified_severity', 
        'verdict_summary'
      ],
    };

    // Try candidate models sequentially
    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [...parts, promptText],
          config: {
            responseMimeType: 'application/json',
            responseSchema: schemaConfig,
          },
        });

        if (response?.text) {
          responseText = response.text;
          break;
        }
      } catch (modelErr) {
        console.warn(`Gemini model ${model} attempt failed:`, modelErr.message);
        lastError = modelErr;
      }
    }

    if (!responseText) {
      throw lastError || new Error('All Gemini model candidates failed to generate forensic verdict.');
    }

    let analysisResult = null;
    try {
      analysisResult = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON response:', responseText);
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI forensic analysis.',
      }, { status: 500 });
    }

    // Strict validation threshold: BOTH media must be genuine AND description must be meaningful
    const isVerified = (
      analysisResult.is_real_hazard === true &&
      analysisResult.is_description_valid === true &&
      (analysisResult.authenticity_confidence || 0) >= 0.60 &&
      analysisResult.detected_hazard_type !== 'none_or_fake'
    );

    // Ensure rejection_reason is populated if rejected
    if (!isVerified && !analysisResult.rejection_reason) {
      if (!analysisResult.is_description_valid) {
        analysisResult.rejection_reason = 'The description provided does not contain meaningful context regarding a road hazard or situation.';
      } else if (!analysisResult.is_real_hazard) {
        analysisResult.rejection_reason = 'Uploaded media does not contain visual evidence of an authentic road hazard.';
      } else {
        analysisResult.rejection_reason = analysisResult.verdict_summary || 'The hazard report could not be verified.';
      }
    }

    return NextResponse.json({
      success: true,
      verified: isVerified,
      analysis: analysisResult,
    });
  } catch (error) {
    console.error('Gemini verification endpoint error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal error during AI verification.' },
      { status: 500 }
    );
  }
}
