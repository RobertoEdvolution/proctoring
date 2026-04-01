/**
 * Quiz finish module — intercepts the "Submit all and finish" form on the
 * summary page and triggers the Cloud Run analysis web service before the
 * form is actually submitted.  Works transparently with Moodle's own
 * confirmation modal: we hook the form's submit() method so *any* code
 * path that submits the form (button click, confirmation dialog, timer)
 * goes through our interceptor first.
 *
 * @module     quizaccess_proctoring/quizfinish
 * @copyright  2024 Brain Station 23
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define(['core/ajax'], function(Ajax) {

    /** @type {boolean} Guard so we only trigger once per page load. */
    var triggered = false;

    /**
     * Fire the Cloud Run analysis call then submit the form for real.
     *
     * @param {HTMLFormElement} form
     * @param {Object}         props  courseid, quizid, status (attemptid)
     */
    var triggerAndSubmit = function(form, props) {
        if (triggered) {
            return;
        }
        triggered = true;

        /**
         * Actually submit the form using the native HTMLFormElement.submit()
         * so our override is bypassed and the page navigates normally.
         */
        var realSubmit = function() {
            HTMLFormElement.prototype.submit.call(form);
        };

        // Safety net: if the AJAX call hangs, submit anyway after 10 s
        // so the student is never blocked.
        var safetyTimer = setTimeout(realSubmit, 10000);

        Ajax.call([{
            methodname: 'quizaccess_proctoring_trigger_analysis',
            args: {
                courseid: props.courseid,
                quizid:   props.quizid,
                attemptid: props.status,
            }
        }])[0].always(function() {
            clearTimeout(safetyTimer);
            realSubmit();
        });
    };

    return {
        /**
         * Initialise the quiz finish interceptor.
         *
         * @param {Object} props Record passed from rule.php (courseid, quizid, status).
         */
        init: function(props) {
            var form = document.getElementById('frm-finishattempt');
            if (!form) {
                // Not on the summary page, or form not yet in the DOM — nothing to do.
                return;
            }

            // Override the form's submit() method.  Moodle's own confirmation
            // module (mod_quiz/submission_confirmation) calls form.submit()
            // after the student confirms, so this intercepts that path.
            form.submit = function() {
                triggerAndSubmit(form, props);
            };

            // Also catch a direct <form> submit event (e.g. Enter key or
            // any code that dispatches a submit event instead of calling .submit()).
            form.addEventListener('submit', function(e) {
                if (!triggered) {
                    e.preventDefault();
                    triggerAndSubmit(form, props);
                }
            });
        }
    };
});