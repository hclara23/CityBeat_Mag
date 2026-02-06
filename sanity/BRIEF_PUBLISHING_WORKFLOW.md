# Brief Publishing Workflow Guide

## Overview

CityBeat Magazine uses an editor-gated publishing workflow for briefs. This ensures all content meets quality standards before being published to readers.

## Workflow States

```
Draft → Pending Review → Approved → Published
                    ↓
                Rejected → Draft (for revision)
```

### State Descriptions

- **Draft**: Initial state. Writers create and edit briefs. Not visible to readers.
- **Pending Review**: Brief submitted for editor review. Awaiting approval or rejection.
- **Approved**: Editor has approved the brief. Ready to be published.
- **Rejected**: Editor found issues requiring revision. Brief returned to draft with notes.
- **Published**: Brief is live and visible to all readers.

## User Roles and Permissions

### Writers
- ✓ Can create new briefs
- ✓ Can edit briefs in Draft status
- ✓ Can submit briefs for review (change status to Pending Review)
- ✗ Cannot approve, reject, or publish briefs
- ✗ Cannot see briefs in Pending Review status from other writers

### Editors
- ✓ Can view all briefs including Pending Review
- ✓ Can approve briefs (change status to Approved)
- ✓ Can reject briefs (change status to Rejected with notes)
- ✓ Can publish approved briefs
- ✓ Can unpublish published briefs
- ✓ Can edit any brief at any stage
- ✓ Can reset rejected/approved briefs back to draft if needed

### Admins
- ✓ All permissions of Editors
- ✓ Can manage user roles and permissions
- ✓ Can access system settings

## How to Use the Workflow

### For Writers

1. **Create a Brief**
   - Click "New Brief" and fill in the title, content, and category
   - Content will be saved as "Draft" by default
   - You can edit and save drafts multiple times

2. **Submit for Review**
   - When ready, change the status from "Draft" to "Pending Review"
   - Click "Save" or "Publish" - the brief will be submitted to editors
   - You'll see "⏳ Pending Review" in the status indicator

3. **Respond to Feedback**
   - If rejected, an editor will provide notes in the "Approval Notes" field
   - Update your brief based on the feedback
   - Change status back to "Pending Review" to resubmit

### For Editors

1. **Review Pending Briefs**
   - Go to the Briefs section and filter by "Pending Review" status
   - Review the content, translations, and metadata
   - Check that sources are properly attributed

2. **Approve a Brief**
   - Click the "Approve Brief" action button
   - Your name and timestamp are automatically recorded
   - The status changes to "Approved" (✅)

3. **Reject a Brief**
   - Click the "Reject Brief" action button
   - Enter specific feedback in the rejection reason dialog
   - The status changes to "Rejected" (❌)
   - The writer can now see your notes and revise

4. **Publish Approved Briefs**
   - Only approved briefs can be published
   - Click "Publish" to make the brief live
   - Status changes to "Published" (🚀)
   - Brief appears on citybeatmag.co immediately

5. **Unpublish if Needed**
   - Click "Unpublish" to temporarily remove from production
   - Brief reverts to "Approved" status
   - Can be republished or edited further

## Approval Information

When a brief is reviewed, the following information is recorded:

- **Reviewed By**: Name of the editor who approved/rejected the brief
- **Review Date**: Timestamp of when the review occurred
- **Approval Notes**:
  - For approvals: Optional notes or comments
  - For rejections: Specific feedback for the writer

This information is only visible when a brief is in Pending Review, Approved, or Rejected status.

## Best Practices

### For Writers
- Submit briefs early in the day to get faster feedback
- Include all required translations (EN/ES) before submitting
- Use clear, concise titles and summaries
- Check the source field is properly attributed

### For Editors
- Review pending briefs within 4 business hours when possible
- Provide constructive feedback in rejection notes
- Look for:
  - Accuracy of information
  - Proper tone and style consistency
  - Complete translations
  - Proper category assignment
  - Source attribution

## System Features

- **Auto-save**: Drafts are automatically saved as you type
- **Preview**: See how briefs will appear to readers before publishing
- **Bilingual Support**: Content, titles, and metadata support both EN and ES
- **Scheduling**: Approved briefs can be scheduled for future publication using the "Published At" field
- **History**: Sanity tracks all revisions and changes

## Troubleshooting

**I can't publish my brief**
→ Check that the status is "Approved" (not "Draft" or "Pending Review")
→ Only editors can publish; ask an editor for help if you're a writer

**I submitted a brief but don't see it in my list**
→ Filter the list to show "Pending Review" status
→ It may be under another writer's name if they created it

**I want to unpublish a brief**
→ Click the "Unpublish" button (only visible for published briefs)
→ Brief reverts to "Approved" status and is removed from readers' view

**I don't see approval/rejection notes**
→ The approval info section only appears when a brief is being reviewed
→ Submit a brief for review first, then check back after an editor reviews it
