/**
 * AI Vision Style Classifier
 *
 * Uses Claude Sonnet via AWS Bedrock to classify the architectural style,
 * materials, era, and overall aesthetic vibe of a home from its listing photo.
 */

import { getAnthropic, extractText, AI_MODEL } from "@/lib/ai/anthropic-client"
import {
  STYLE_CATEGORIES,
  type StyleClassification,
  type ArchitecturalStyle,
  type ExteriorMaterial,
  type EraFeel,
  type LandscapeStyle,
  type VibeTag,
  type ColorPalette,
} from "./style-tags"


const SYSTEM_PROMPT = `You are a home style classifier. Given an exterior photo of a residential property, classify it into structured style tags. Respond with ONLY valid JSON matching this schema — no markdown, no explanation:

{
  "architectural_style": string[],  // 1-2 from: ${STYLE_CATEGORIES.architectural.join(", ")}
  "exterior_material": string[],    // 1-3 from: ${STYLE_CATEGORIES.material.join(", ")}
  "era_feel": string,               // one of: ${STYLE_CATEGORIES.era.join(", ")}
  "landscape_style": string,        // one of: ${STYLE_CATEGORIES.landscape.join(", ")}
  "overall_vibe": string[],         // 2-3 from: ${STYLE_CATEGORIES.vibe.join(", ")}
  "color_palette": string           // one of: ${STYLE_CATEGORIES.color_palette.join(", ")}
}

If the image is not a home exterior (interior shot, floor plan, etc.), still provide your best guess based on visible clues. If the image is completely unrelated, return all neutral defaults.`

/**
 * Classify a home's exterior style from a photo URL.
 *
 * @param photoUrl - MLS PIN media URL (e.g., https://media.mlspin.com/photo.aspx?mls=12345&n=0&w=1024&h=768)
 * @returns StyleClassification or null if classification fails
 */
export async function classifyStyle(
  photoUrl: string
): Promise<StyleClassification | null> {
  try {
    // Download the image and convert to base64 (Bedrock requires base64)
    const imageResponse = await fetch(photoUrl)
    if (!imageResponse.ok) {
      console.error(`[classify-style] Photo fetch failed: ${imageResponse.status}`)
      return null
    }
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString("base64")
    const rawType = imageResponse.headers.get("content-type") || "image/jpeg"
    // Anthropic accepts a fixed set of image media types; normalize + default.
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const
    const mediaType = (allowed as readonly string[]).includes(rawType)
      ? (rawType as (typeof allowed)[number])
      : "image/jpeg"

    const client = getAnthropic()
    if (!client) return null // no API key → skip classification (caller handles null)

    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Image },
            },
            { type: "text", text: "Classify this home." },
          ],
        },
      ],
    })

    const text = extractText(response)
    if (!text) return null

    const raw = JSON.parse(text)
    return validateAndNormalize(raw)
  } catch (error) {
    console.error(
      "[classify-style] Failed to classify:",
      error instanceof Error ? error.message : String(error)
    )
    return null
  }
}

/**
 * Validate and normalize raw AI output against our taxonomy.
 * Filters out any tags that aren't in our known vocabulary.
 */
function validateAndNormalize(
  raw: Record<string, unknown>
): StyleClassification | null {
  try {
    const architecturalSet = new Set<string>(STYLE_CATEGORIES.architectural)
    const materialSet = new Set<string>(STYLE_CATEGORIES.material)
    const eraSet = new Set<string>(STYLE_CATEGORIES.era)
    const landscapeSet = new Set<string>(STYLE_CATEGORIES.landscape)
    const vibeSet = new Set<string>(STYLE_CATEGORIES.vibe)
    const paletteSet = new Set<string>(STYLE_CATEGORIES.color_palette)

    const architectural_style = filterArray(
      raw.architectural_style,
      architecturalSet
    ) as ArchitecturalStyle[]

    const exterior_material = filterArray(
      raw.exterior_material,
      materialSet
    ) as ExteriorMaterial[]

    const era_feel = (
      eraSet.has(raw.era_feel as string) ? raw.era_feel : "contemporary"
    ) as EraFeel

    const landscape_style = (
      landscapeSet.has(raw.landscape_style as string)
        ? raw.landscape_style
        : "minimal"
    ) as LandscapeStyle

    const overall_vibe = filterArray(
      raw.overall_vibe,
      vibeSet
    ) as VibeTag[]

    const color_palette = (
      paletteSet.has(raw.color_palette as string)
        ? raw.color_palette
        : "neutral"
    ) as ColorPalette

    // Must have at least one architectural style to be valid
    if (architectural_style.length === 0) {
      return null
    }

    return {
      architectural_style,
      exterior_material,
      era_feel,
      landscape_style,
      overall_vibe,
      color_palette,
    }
  } catch {
    return null
  }
}

/**
 * Filter an unknown value to only include strings that exist in allowedSet.
 */
function filterArray(value: unknown, allowedSet: Set<string>): string[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is string => typeof item === "string" && allowedSet.has(item)
  )
}
