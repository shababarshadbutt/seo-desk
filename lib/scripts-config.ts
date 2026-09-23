import {
  Map,
  Upload,
  Search,
  Send,
  Trash2,
  BarChart3,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type InputType = "url" | "text" | "textarea" | "file" | "date" | "select" | "multi-site-urls";

export interface ScriptInput {
  name: string;
  label: string;
  type: InputType;
  placeholder?: string;
  description?: string;
  required: boolean;
  options?: { label: string; value: string }[];
  accept?: string;
  folder?: boolean; // enables folder/multi-file upload (webkitdirectory)
  // For type "select": fetch live options instead of using the static `options` list.
  // "websites" -> populated from /api/websites (the app's tracked site list).
  dynamicOptionsSource?: "websites";
}

export interface ScriptConfig {
  slug: string;
  name: string;
  description: string;
  icon: LucideIcon;
  pythonFile: string;
  inputs: ScriptInput[];
  outputLabel?: string;
  // If true, the API route auto-fetches Google credentials from Settings and
  // passes them as --service_account_file to the Python script.
  requiresServiceAccount?: boolean;
  // If true, shows a multi-select for service accounts; runs once per selected
  // account sequentially, all output in a single terminal.
  multiServiceAccount?: boolean;
  // If set, shows an "Open Sheet" button after successful run.
  sheetUrl?: string;
}

export const scripts: ScriptConfig[] = [
  {
    slug: "sitemap-url-extractor",
    name: "Sitemap URL Extractor",
    description: "Enter a site — automatically finds its robots.txt, walks every nested sitemap index, and extracts every page URL into a downloadable CSV.",
    icon: Map,
    pythonFile: "sitemap_url_extractor.py",
    outputLabel: "CSV of all page URLs found",
    inputs: [
      {
        name: "site_url",
        label: "Website",
        type: "select",
        dynamicOptionsSource: "websites",
        placeholder: "Select a tracked site or type a domain…",
        description: "Pick a tracked site, or type any domain with or without https://. We'll find robots.txt and walk every sitemap automatically.",
        required: true,
      },
    ],
  },
  {
    slug: "url-indexer",
    name: "GSC URL Indexer",
    description: "Submits URLs to Google's Indexing API. Add multiple websites at once — 200 URLs per site.",
    icon: Upload,
    pythonFile: "url_indexer.py",
    outputLabel: "Submission status per URL + CSV log",
    requiresServiceAccount: true,
    inputs: [
      {
        name: "urls",
        label: "URLs",
        type: "multi-site-urls",
        required: true,
      },
    ],
  },
  {
    slug: "bing-indexnow",
    name: "Bing URL Indexer",
    description: "Submit URLs to Bing instantly via the IndexNow protocol — no waiting for the crawler.",
    icon: Zap,
    pythonFile: "bing_indexnow.py",
    outputLabel: "Submission log CSV",
    inputs: [
      {
        name: "urls",
        label: "URLs",
        type: "multi-site-urls",
        required: true,
      },
    ],
  },
  {
    slug: "indexing-checker",
    name: "Indexing Checker",
    description: "Checks Google Search Console to verify which URLs are indexed and when they were last crawled.",
    icon: Search,
    pythonFile: "indexing_checker.py",
    outputLabel: "Index verdict + last crawl date per URL",
    requiresServiceAccount: true,
    inputs: [
      {
        name: "gsc_property",
        label: "GSC Property URL",
        type: "url",
        placeholder: "https://example.com/",
        description: "Must match exactly how the property is registered in Search Console.",
        required: true,
      },
      {
        name: "urls",
        label: "URLs to Check",
        type: "textarea",
        placeholder: "https://example.com/page-1\nhttps://example.com/page-2",
        description: "Enter one URL per line, or upload a CSV file below.",
        required: false,
      },
      {
        name: "csv_file",
        label: "Or Upload a CSV",
        type: "file",
        accept: ".csv",
        description: "CSV must have a column named 'url'.",
        required: false,
      },
    ],
  },
  {
    slug: "gsc-sitemap-submitter",
    name: "GSC Sitemap Submitter",
    description: "Bulk-submits sitemaps to a Google Search Console property.",
    icon: Send,
    pythonFile: "gsc_sitemap_submitter.py",
    outputLabel: "Submission confirmation per sitemap",
    requiresServiceAccount: true,
    inputs: [
      {
        name: "gsc_property",
        label: "GSC Property URL",
        type: "url",
        placeholder: "https://example.com/",
        description: "Must match exactly how the property is registered in Search Console.",
        required: true,
      },
      {
        name: "sitemap_urls",
        label: "Sitemap URLs",
        type: "textarea",
        placeholder: "https://example.com/sitemap.xml\nhttps://example.com/sitemap2.xml",
        description: "Enter one sitemap URL per line.",
        required: true,
      },
    ],
  },
  {
    slug: "sitemap-deleter",
    name: "Sitemap Deleter",
    description: "Removes specific sitemaps from a Google Search Console property.",
    icon: Trash2,
    pythonFile: "sitemap_deleter.py",
    outputLabel: "Deletion confirmation per sitemap",
    requiresServiceAccount: true,
    inputs: [
      {
        name: "gsc_property",
        label: "GSC Property URL",
        type: "url",
        placeholder: "https://example.com/",
        description: "Must match exactly how the property is registered in Search Console.",
        required: true,
      },
      {
        name: "sitemap_urls",
        label: "Sitemap URLs to Delete",
        type: "textarea",
        placeholder: "https://example.com/old-sitemap.xml\nhttps://example.com/sitemap2.xml",
        description: "Enter one sitemap URL per line.",
        required: true,
      },
    ],
  },
  {
    slug: "ga4-reporter",
    name: "GA4 Reporter",
    description: "Pulls total users from GA4 for all configured properties and writes to a Google Sheet.",
    icon: BarChart3,
    pythonFile: "ga4_reporter.py",
    outputLabel: "Traffic data written to Google Sheet",
    sheetUrl: "https://docs.google.com/spreadsheets/d/1ZQk2DZ4EN-n_L-YTyn1f0sCSQL0BzmlvyYdjTwiTEi8/edit?usp=sharing",
    inputs: [
      {
        name: "start_date",
        label: "Start Date",
        type: "date",
        required: true,
      },
      {
        name: "end_date",
        label: "End Date",
        type: "date",
        required: true,
      },
      {
        name: "sheet_name",
        label: "Google Sheet Name",
        type: "text",
        placeholder: "Weekly GA4 Report",
        description: "Exact name of the Google Sheet to write results to.",
        required: true,
      },
    ],
  },
];

export function getScriptBySlug(slug: string): ScriptConfig | undefined {
  return scripts.find((s) => s.slug === slug);
}
