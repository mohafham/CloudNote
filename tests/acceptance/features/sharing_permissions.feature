Feature: Sharing and collaboration permissions
  As a note owner
  I want to share notes with controlled permissions
  So that collaborators can access notes safely

  Scenario: Create and use copy link share
    Given I own a note named "Architecture"
    When I open the share panel from the note popup
    And I choose "View only"
    And I copy the generated link
    Then recipients opening the link should have read access only

  Scenario: Share from note card hover
    Given I own multiple notes
    When I hover over a note card
    Then I should see a share action
    When I create a link with "Can edit"
    Then recipients should be able to edit that note

  Scenario: Revoke share link and collaborator access
    Given I shared a note with edit permission
    When I revoke the share link
    Then link access should be denied
    When I remove a collaborator account
    Then that account should lose note access
