Feature: Cloud sync and realtime collaboration
  As collaborating users
  I want synchronized and live updates
  So that everyone sees the same note state quickly

  Scenario: Multi-device cloud sync
    Given I am signed in on device A
    And I create a note titled "Daily Standup"
    When I sign in on device B with the same account
    Then I should see "Daily Standup" on device B

  Scenario: Simultaneous editing with permission enforcement
    Given user A and user B are in the same shared note
    And user B has edit access
    When user A changes the note body
    Then user B should see the change quickly
    When a view-only user joins the same note
    Then write events from that user should be rejected

  Scenario: Presence visibility
    Given multiple users are connected to a shared note room
    When one user joins or leaves
    Then collaboration presence should update for all connected users
