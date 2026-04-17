Feature: Notes, folders, and checklist operations
  As an authenticated user
  I want to organize notes and tasks efficiently
  So that my workspace remains structured and actionable

  Scenario: Create, edit, and delete a note
    Given I am signed in
    When I click the plus button and create a note titled "Sprint Plan"
    Then the note should appear on the home screen
    When I edit the note content
    Then the updated content should be saved
    When I delete the note
    Then the note should no longer appear on the home screen

  Scenario: Organize items in folders
    Given I am signed in
    When I create a folder named "Design"
    And I create a note in "Design"
    And I create a checklist in "Design"
    Then both items should be visible when browsing that folder
    And folder cards should be visually different from note cards

  Scenario: Use standalone and embedded checklists
    Given I am signed in
    When I create a standalone checklist on the home page
    Then I should be able to add, check, uncheck, reorder, and delete checklist items without opening a popup
    When I open a normal note
    And I add an embedded checklist block
    Then the embedded checklist should persist inside the note
