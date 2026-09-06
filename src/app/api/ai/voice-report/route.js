import { GoogleGenAI, Type } from '@google/genai';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'GEMINI_API_KEY is not configured in .env.local.' 
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const body = await req.json();
    const { 
      audioBase64 = null, 
      mimeType = 'audio/webm',
      textInput = null,
      currentFormData = {},
      conversationHistory = [] 
    } = body;

    if (!audioBase64 && !textInput) {
      return NextResponse.json(
        { success: false, error: 'No audio or text input provided for voice analysis.' },
        { status: 400 }
      );
    }

    const parts = [];

    // 1. Process audio buffer if provided
    if (audioBase64) {
      const cleanData = audioBase64.replace(/^data:[^;]+;base64,/, '');
      const baseMime = (mimeType || 'audio/webm').split(';')[0].trim();
      parts.push({
        inlineData: {
          data: cleanData,
          mimeType: baseMime || 'audio/webm',
        },
      });
    }

    // 2. Prepare Context & Prompt
    const existingContext = currentFormData ? `
      CURRENT FORM CONTEXT (ALREADY KNOWN):
      - Hazard Type: ${currentFormData.hazardType || 'unspecified'}
      - Severity: ${currentFormData.severity || 'unspecified'}
      - Description: "${currentFormData.description || ''}"
      - State: ${currentFormData.state || 'Assam'}
      - District: ${currentFormData.district || ''}
      - Coords: ${currentFormData.latitude || ''}, ${currentFormData.longitude || ''}
    ` : '';

    const historyContext = conversationHistory && conversationHistory.length > 0 
      ? `PREVIOUS TURNS IN THIS VOICE SESSION: ${JSON.stringify(conversationHistory.slice(-3))}` 
      : '';

    const textPayload = textInput ? `DRIVER'S TRANSCRIPTION INPUT: "${textInput}"` : '';

    const promptText = `
      You are the Multilingual Voice Logistics Assistant for the North-Eastern Region (NER) Disaster Logistics Platform (India).
      You are assisting a driver (who may be illiterate, non-English speaking, or driving in an emergency) to report a road disaster hands-free.
      
      The driver may speak in ANY regional language (e.g. Hindi, Assamese, Bengali, English, Manipuri, Bodo, Nepali, Nagamese, Mizo, Khasi, Garo).
      
      ${existingContext}
      ${historyContext}
      ${textPayload}

      YOUR TASKS:
      1. Listen to the audio (or read text) and accurately detect the language and transcribe what the driver spoke in their original script/words into 'original_transcript'.
      2. Extract structured emergency hazard data:
         - hazard_type: Map to exactly one of ['landslide', 'flash_flood', 'road_washout', 'bridge_damage', 'tree_fall', 'heavy_waterlogging', 'unknown']
           * "pahad gir gaya" / "mud/rock slide" / "mati porise" -> 'landslide'
           * "paani bhar gaya" / "pani joma" / "boil" -> 'flash_flood' or 'heavy_waterlogging'
           * "rasta toot gaya" / "bhangi goise" -> 'road_washout'
           * "pul toot gaya" / "bridge damage" -> 'bridge_damage'
           * "ped gir gaya" / "gach porise" -> 'tree_fall'
         - severity: Map to ['critical', 'high', 'medium', 'low', 'unknown']
           * Total road block, trapped vehicles, emergency -> 'critical'
           * Big damage, single lane blocked -> 'high'
           * Caution, slow movement -> 'medium'
         - location_hint: Extract any mentioned landmark, highway, town, or distance (e.g., "NH-27 near Haflong", "between Guwahati and Shillong", "2km past Jorhat").
         - description_summary: Synthesize a professional, clear English summary describing the incident for the official disaster management log.
         - impact_radius_km: Estimate reasonable danger perimeter in km (defaults to 5.0).
      
      3. COMPLETION CHECK & MULTILINGUAL CONVERSATIONAL VOICE REPLY:
         - Minimum essential fields needed: Valid hazard type AND an understanding of the road blockage/situation.
         - If any essential information is missing:
           * Set is_complete: false.
           * List the missing items in missing_fields (e.g. ['location', 'hazard_type']).
           * In 'voice_reply_prompt', write a warm, clear, conversational spoken question in the DRIVER'S DETECTED NATIVE SPOKEN LANGUAGE asking for the specific missing detail.
         - If all essential information is present:
           * Set is_complete: true.
           * In 'voice_reply_prompt', write a warm confirmation message in the DRIVER'S DETECTED NATIVE SPOKEN LANGUAGE confirming what was understood and informing them the details have been filled into the report.
    `;

    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.8-flash',
    ];

    const schemaConfig = {
      type: Type.OBJECT,
      properties: {
        detected_language: { 
          type: Type.STRING, 
          description: 'Spoken language name (e.g. Hindi, Assamese, Bengali, English).' 
        },
        original_transcript: { 
          type: Type.STRING, 
          description: 'Exact transcription of what the driver spoke.' 
        },
        hazard_type: { 
          type: Type.STRING, 
          enum: ['landslide', 'flash_flood', 'road_washout', 'bridge_damage', 'tree_fall', 'heavy_waterlogging', 'other', 'unknown'] 
        },
        severity: { 
          type: Type.STRING, 
          enum: ['critical', 'high', 'medium', 'low', 'unknown'] 
        },
        location_hint: { 
          type: Type.STRING, 
          description: 'Any mentioned highway, landmark, or town.' 
        },
        description_summary: { 
          type: Type.STRING, 
          description: 'Synthesized professional English summary of the report.' 
        },
        impact_radius_km: { 
          type: Type.NUMBER, 
          description: 'Suggested impact danger radius in km (default 5.0).' 
        },
        is_complete: { 
          type: Type.BOOLEAN, 
          description: 'True if hazard type and situation are sufficiently understood; false if vital info is missing.' 
        },
        missing_fields: { 
          type: Type.ARRAY, 
          items: { type: Type.STRING } 
        },
        voice_reply_prompt: { 
          type: Type.STRING, 
          description: 'Natural, conversational spoken response back to the driver in their native spoken language.' 
        },
      },
      required: [
        'detected_language',
        'original_transcript',
        'hazard_type',
        'severity',
        'description_summary',
        'is_complete',
        'voice_reply_prompt'
      ],
    };

    let lastError = null;
    let responseText = null;

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
        console.warn(`Gemini voice model ${model} attempt failed:`, modelErr.message);
        lastError = modelErr;
      }
    }

    if (!responseText) {
      throw lastError || new Error('All Gemini model candidates failed to process voice input.');
    }

    let parsedResult = null;
    try {
      parsedResult = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini Voice JSON response:', responseText);
      return NextResponse.json({
        success: false,
        error: 'Failed to parse voice response.',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: parsedResult,
    });
  } catch (error) {
    console.error('Voice report route error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal error during voice processing.' },
      { status: 500 }
    );
  }
}
