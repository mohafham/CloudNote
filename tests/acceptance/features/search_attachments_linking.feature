Feature: Search, attachments, and note linking
  As a user
  I want fast retrieval and richer content support
  So that notes are easy to discover and useful

  Scenario: Search prioritizes title matches
    Given I have notes with keyword "sync" in both titles and bodies
    When I search for "sync"
    Then notes with title matches should appear before body-only matches

  Scenario: Attach supported files to note
    Given I am editing a note
    When I attach "diagram.pdf"
    Then the file should be accepted
    And an attachment card should be displayed in note context
    When I attach an unsupported file type
    Then upload should be rejected with a clear message

  Scenario: Link notes from inside notes
    Given I have notes "API Spec" and "Client Integration"
    When I link "Client Integration" inside "API Spec"
    Then the link should be saved and visible
    And selecting the link should open the target note
