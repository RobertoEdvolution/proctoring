<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Event observers for the quizaccess_proctoring plugin.
 *
 * @package    quizaccess_proctoring
 * @copyright  2024 Brain Station 23
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$observers = [
    // Fires when a student or admin/teacher starts a regular attempt.
    [
        'eventname' => '\mod_quiz\event\attempt_started',
        'callback'  => '\quizaccess_proctoring\quizaccess_proctoring_observer::handle_quiz_attempt_started',
    ],
    // Fires when ANY user submits an attempt (student, admin preview, teacher preview).
    // This is the PRIMARY trigger for Cloud Run analysis.
    [
        'eventname' => '\mod_quiz\event\attempt_submitted',
        'callback'  => '\quizaccess_proctoring\quizaccess_proctoring_observer::handle_quiz_attempt_submitted',
    ],
    // Fires when an admin/teacher starts a preview attempt.
    [
        'eventname' => '\mod_quiz\event\attempt_preview_started',
        'callback'  => '\quizaccess_proctoring\quizaccess_proctoring_observer::handle_quiz_attempt_started',
    ],
    // Fires when a teacher reviews/grades a student's attempt (fallback trigger).
    [
        'eventname' => '\mod_quiz\event\attempt_reviewed',
        'callback'  => '\quizaccess_proctoring\quizaccess_proctoring_observer::handle_quiz_attempt_reviewed',
    ],
];