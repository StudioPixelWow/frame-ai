/**
 * GAQL (Google Ads Query Language) queries used to pull every metric the report
 * needs. {from}/{to} are ISO dates (YYYY-MM-DD). These are sent to the Google
 * Ads API searchStream endpoint when a live connection exists.
 */

export const GAQL = {
  // Account-level totals over the period.
  accountTotals: (from: string, to: string) => `
    SELECT metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc,
           metrics.cost_micros, metrics.conversions, metrics.conversions_value,
           metrics.cost_per_conversion, metrics.conversions_from_interactions_rate
    FROM customer
    WHERE segments.date BETWEEN '${from}' AND '${to}'`,

  campaigns: (from: string, to: string) => `
    SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros,
           metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc,
           metrics.cost_micros, metrics.conversions, metrics.conversions_value,
           metrics.cost_per_conversion
    FROM campaign
    WHERE segments.date BETWEEN '${from}' AND '${to}' AND campaign.status != 'REMOVED'
    ORDER BY metrics.conversions DESC`,

  adGroups: (from: string, to: string) => `
    SELECT ad_group.id, ad_group.name, campaign.name,
           metrics.impressions, metrics.clicks, metrics.conversions, metrics.cost_micros
    FROM ad_group
    WHERE segments.date BETWEEN '${from}' AND '${to}' AND ad_group.status != 'REMOVED'
    ORDER BY metrics.conversions DESC`,

  keywords: (from: string, to: string) => `
    SELECT ad_group_criterion.keyword.text, metrics.impressions, metrics.clicks,
           metrics.ctr, metrics.conversions, metrics.cost_micros
    FROM keyword_view
    WHERE segments.date BETWEEN '${from}' AND '${to}'
    ORDER BY metrics.conversions DESC LIMIT 25`,

  searchTerms: (from: string, to: string) => `
    SELECT search_term_view.search_term, metrics.impressions, metrics.clicks,
           metrics.ctr, metrics.conversions, metrics.cost_micros
    FROM search_term_view
    WHERE segments.date BETWEEN '${from}' AND '${to}'
    ORDER BY metrics.conversions DESC LIMIT 25`,

  devices: (from: string, to: string) => `
    SELECT segments.device, metrics.impressions, metrics.clicks,
           metrics.conversions, metrics.cost_micros
    FROM customer WHERE segments.date BETWEEN '${from}' AND '${to}'`,

  locations: (from: string, to: string) => `
    SELECT geographic_view.country_criterion_id, metrics.impressions, metrics.clicks,
           metrics.conversions, metrics.cost_micros
    FROM geographic_view WHERE segments.date BETWEEN '${from}' AND '${to}'
    ORDER BY metrics.conversions DESC LIMIT 10`,

  hourOfDay: (from: string, to: string) => `
    SELECT segments.hour, metrics.clicks, metrics.conversions, metrics.cost_micros
    FROM customer WHERE segments.date BETWEEN '${from}' AND '${to}'`,

  dailyTrend: (from: string, to: string) => `
    SELECT segments.date, metrics.clicks, metrics.conversions,
           metrics.cost_micros, metrics.impressions
    FROM customer WHERE segments.date BETWEEN '${from}' AND '${to}'
    ORDER BY segments.date`,

  optimizationScore: () => `
    SELECT customer.optimization_score FROM customer`,

  recommendations: () => `
    SELECT recommendation.type, recommendation.campaign FROM recommendation LIMIT 10`,
};
