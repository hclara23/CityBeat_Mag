---
id: "202610151955-D5BBRV"
title: "Research compliant connected-payee payout frequency"
status: "DONE"
priority: "high"
owner: "REVIEWER"
depends_on: []
tags: ["stripe", "legal-research", "payouts", "compliance"]
commit: { hash: "ce0190bfc38df4fc97d810d9932ba898bc56aaad", message: "📝 D5BBRV document Stripe payout cadence and New Mexico commission compliance guidance" }
comments:
  - { author: "REVIEWER", body: "Start: research current Stripe Connect payout schedules and authoritative New Mexico and federal commission-payment rules; compare operational options without changing settings or moving funds" }
  - { author: "REVIEWER", body: "verified: documented authoritative Stripe, New Mexico, federal and tax guidance | details: recommended after-clearance transfers, editor automatic standard payouts, platform manual payouts and monthly statements, subject to classification and contract review." }
doc_version: 2
doc_updated_at: "2026-10-15T20:00:09+00:00"
doc_updated_by: "agentctl"
description: "Research current Stripe Connect payout constraints and applicable New Mexico and United States rules for paying editor or contractor commissions. Compare after-clearance, twice-monthly, and monthly schedules; document authoritative sources, contractual caveats, operational risks, and a recommended policy without changing financial settings."
---
## Summary

Assuming the editor is correctly classified as an independent contractor and the written agreement makes each commission due only after the customer payment clears, use a charge-linked Connect transfer as soon as funds become available and keep the connected account on daily automatic standard payouts. Keep the CityBeat platform account on manual payouts so only the platform share accumulates. Send a monthly statement for transparency and reconciliation; the statement cadence should not delay earned commissions. If the editor is legally an employee, New Mexico wage-payment deadlines apply and the agreement plus payroll process must be reviewed before relying on contractor treatment.

## Context

This review is informational, not legal advice. It assumes CityBeat is the Stripe platform and business of record, customer charges land in the platform balance, the editor has a connected account and external bank account, and CityBeat uses separate charges and transfers or an equivalent Connect flow. A Stripe transfer moves money from the platform balance to the connected Stripe account; a payout then moves the connected-account balance to the bank. Those are separate events and must be reported separately.

## Scope

Legal baseline: New Mexico Wage Payment Act NMSA 1978 Section 50-4-2 requires employee paydays no more than 16 days apart and sets semimonthly deadlines. Commission, task, or piece-rate employees may agree in writing at hiring to monthly payment by the tenth day of the succeeding month; certain professional, administrative, executive, and outside-sales employees may also be paid monthly. Section 50-4-1 defines employee wages to include commissions. The New Mexico Department of Workforce Solutions 2025 investigations manual describes these as requirements for covered employment relationships. The federal Department of Labor states that the FLSA does not itself require commissions, although employee minimum-wage and overtime rules can still apply. For a bona fide independent contractor, these employee payday provisions are not a safe substitute for the contract: the written commission agreement should define when a commission is earned, clearance, refund/dispute treatment, calculation, payout timing, records, and termination. Classification is fact-specific; IRS and New Mexico Taxation and Revenue guidance focus on behavioral control, financial control, and the parties relationship, and a label or Form 1099 does not decide status. For 2026 payments, IRS instructions state that Form 1099-NEC generally reports qualifying nonemployee compensation of $2,000 or more; this annual tax filing does not replace monthly statements.

## Risks

Classification risk is the leading legal risk. If the editor is an employee, delaying ordinary commissions to a monthly contractor cycle could violate New Mexico rules unless a valid statutory monthly arrangement applies. A written contractor label alone does not cure misclassification. Contract risk remains even for a contractor: CityBeat must follow the promised earned-and-payable date. Refunds, disputes, failed ACH payments, negative balances, taxes, and termination need explicit treatment. Stripe settlement timing and payout cadence are different: changing daily to twice-monthly or monthly does not make funds clear faster. Platform automatic payouts can drain funds needed for a separate transfer that lacks source_transaction; charge-linked transfers mitigate that risk. Daily standard payouts create more bank entries but do not prevent monthly reporting. Instant Payouts can have account-specific fees and should not be enabled merely to satisfy prompt standard payout intent. Obtain New Mexico employment counsel review of the actual duties and agreement before treating the editor as a contractor.

## Verify Steps

Before configuration: (1) counsel or payroll adviser confirms worker classification and reviews the commission agreement; (2) confirm the connected-account type and that CityBeat has payout-schedule control; (3) verify each recurring invoice preserves payee attribution; (4) create transfers idempotently only after successful payment, preferably tied to source_transaction for card charges; (5) keep CityBeat platform payouts manual and connected-editor payouts daily automatic standard; (6) subscribe to transfer and payout created, updated, paid, failed, refund, and dispute events; (7) reconcile monthly statement totals to Stripe balance transactions, transfers, reversals, payouts, and the internal commission ledger; (8) test failed payment, refund, dispute, duplicate webhook, insufficient balance, and failed payout paths without moving live funds.

## Rollback Plan

No financial configuration or funds were changed. If later legal review identifies employee status or a conflicting contract, stop the contractor schedule, preserve records, calculate any arrears, and adopt a compliant payroll cadence before further commissions. If daily connected payouts cause reconciliation or reserve problems, move prospectively to a documented twice-monthly schedule only after agreement review and notice; never retroactively delay already earned amounts.

## Notes

Recommendation and comparison (accessed 2026-10-15): Immediate-after-clearance plus daily automatic connected payout best matches the stated promise and minimizes payee delay; it creates the most payout entries, so aggregate them into one monthly statement. Twice monthly is a reasonable fallback when reserves, refund exposure, or accounting capacity justify batching; it is easier to reconcile and tracks the New Mexico employee default cadence, but it unnecessarily delays a bona fide contractor when the contract promises prompt payment. Monthly is simplest administratively but least aligned with prompt payment and is legally risky for an employee unless the written-at-hiring commission/task exception or another statutory monthly exception applies. The monthly statement should show opening payable balance; each customer payment/invoice; gross eligible revenue; rate or formula; commission earned; transfer ID/date/status; payout ID/date/status/arrival; refunds, disputes, reversals, holds, adjustments; ending payable balance; year-to-date earned and paid; and contact/dispute instructions. Primary and official sources: Stripe Manage payout schedule https://docs.stripe.com/connect/manage-payout-schedule ; Stripe Connect payouts https://docs.stripe.com/connect/payouts-connected-accounts ; Stripe Receive payouts https://docs.stripe.com/payouts ; Stripe Separate charges and transfers https://docs.stripe.com/connect/separate-charges-and-transfers ; New Mexico DWS 2025 Investigations Manual, including its explanation of NMSA 1978 Sections 50-4-1 and 50-4-2, https://www.dws.state.nm.us/Portals/0/DM/LaborRelations/LRD_Investigations_Manual_2025.pdf ; U.S. DOL Commissions https://www.dol.gov/general/topic/wages/commissions ; IRS worker classification https://www.irs.gov/taxtopics/tc762 ; New Mexico Taxation and Revenue contractor classification https://www.tax.newmexico.gov/individuals/personal-income-tax-information-overview/independent-contractors-vs-employees/ ; IRS 2026 Forms 1099-MISC and 1099-NEC instructions https://www.irs.gov/instructions/i1099mec .

