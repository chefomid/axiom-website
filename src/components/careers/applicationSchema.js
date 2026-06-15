/**
 * AXIOM careers application schema.
 *
 * Field types: text | email | tel | cityState | textarea | url | file | choice |
 * multiselect | ratingGroup | likertGroup | yesNoGroup | sentenceGroup
 */
import { MISSION_PATH } from '../../constants/routes'

export const APPLICATION_DRAFT_KEY = 'axiom-careers-application-draft-v3'
export const APPLICATION_ROLE = 'Project Manager'
export const APPLICATION_TITLE = 'Application'
export const APPLICATION_SUBTITLE = APPLICATION_ROLE
export const APPLICATION_PURPOSE =
  'Share your background and what draws you to AXIOM. We review each submission with care and focus on fit, motivation, and potential.'
export const APPLICATION_SUCCESS_MESSAGE =
  'Every meaningful achievement begins with a single step. Thank you for taking this one. We look forward to learning more about your story.'
export const APPLICATION_NEXT_STEPS = [
  'We review every submission carefully.',
  'If your profile aligns with what we are building, we will reach you at the phone number or email you provided.',
  'No further action is needed from you right now.',
]
export const APPLICATION_STEPS = [
  {
    id: 'basics',
    title: 'Basic Information',
    intro: 'Start with the essentials. Phone is our primary way to reach you.',
    fields: [
      {
        id: 'firstName',
        label: 'First name',
        type: 'text',
        required: true,
        autoComplete: 'given-name',
      },
      {
        id: 'lastName',
        label: 'Last name',
        type: 'text',
        required: true,
        autoComplete: 'family-name',
      },
      {
        id: 'preferredName',
        label: 'Preferred name',
        type: 'text',
        required: true,
        autoComplete: 'nickname',
      },
      { id: 'email', label: 'Email', type: 'email', required: true, autoComplete: 'email' },
      {
        id: 'phone',
        label: 'Phone number',
        type: 'tel',
        required: true,
        autoComplete: 'tel',
        hint: 'Primary contact method.',
      },
      {
        id: 'location',
        label: 'City / state',
        type: 'cityState',
        required: true,
        placeholder: 'City, state',
      },
      {
        id: 'linkedIn',
        label: 'LinkedIn (optional)',
        type: 'url',
        placeholder: 'https://linkedin.com/in/your-profile',
      },
      {
        id: 'resumeFile',
        label: 'Resume upload (optional)',
        type: 'file',
        accept: '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg',
        hint: 'Or paste a link below.',
      },
      {
        id: 'resumeLink',
        label: 'Resume link (optional)',
        type: 'url',
        placeholder: 'https:// link to your resume (Google Drive, PDF, etc.)',
      },
      {
        id: 'portfolio',
        label: 'Portfolio / website (optional)',
        type: 'url',
        placeholder: 'https://your-portfolio.com',
      },
      {
        id: 'socialProfiles',
        label: 'Social profiles (optional)',
        type: 'text',
        placeholder: 'Instagram, X, GitHub, or other profile links',
      },
    ],
  },
  {
    id: 'ambition',
    title: 'Motivation & Ambition',
    introParts: [
      {
        type: 'text',
        value:
          'We are not looking for empty corporate hustle. If the mission genuinely resonates with you (',
      },
      { type: 'link', label: 'mission', to: MISSION_PATH },
      {
        type: 'text',
        value:
          '), how committed would you be? Rate each statement (1 = not yet, 10 = fully committed).',
      },
    ],
    fields: [
      {
        id: 'ambitionRatings',
        label: 'Your commitments',
        type: 'ratingGroup',
        required: true,
        max: 10,
        itemPrefix: 'If I am passionate about the mission,',
        scaleHint: '1 = not yet · 10 = fully committed',
        items: [
          {
            id: 'seekBeyond',
            label:
              'I will actively seek opportunities to contribute beyond what is expected of me.',
          },
          {
            id: 'learnMonthly',
            label:
              'I will dedicate time each month to learning skills that improve my effectiveness.',
          },
          {
            id: 'takeRisks',
            label: 'I will take calculated risks when they support meaningful goals.',
          },
          {
            id: 'buildNotMaintain',
            label: 'I will choose to build new things rather than only maintain what exists.',
          },
        ],
      },
    ],
  },
  {
    id: 'creativity',
    title: 'Creativity',
    intro: 'How strongly do you agree with each commitment?',
    fields: [
      {
        id: 'creativityLikert',
        label: 'Creativity commitments',
        type: 'likertGroup',
        required: true,
        items: [
          { id: 'betterWays', label: 'I will look for better ways to do things.' },
          {
            id: 'unclearProblems',
            label: 'I will work on problems that do not have clear answers.',
          },
          { id: 'writeIdeas', label: 'I will write down ideas when they come to me.' },
          {
            id: 'createOutside',
            label: 'I will create things outside my assigned responsibilities when I see the need.',
          },
        ],
      },
      {
        id: 'mostInterestingCreation',
        label: 'What is the most interesting thing you have built, improved, or created?',
        type: 'textarea',
        required: true,
        rows: 6,
        placeholder: 'School project, personal site, art, fix at home, anything counts\u2026',
      },
    ],
  },
  {
    id: 'ownership',
    title: 'Ownership',
    intro: 'Quick yes or no, no experience required.',
    fields: [
      {
        id: 'ownershipYesNo',
        label: 'Have you ever\u2026',
        type: 'yesNoGroup',
        required: true,
        items: [
          { id: 'selfTaught', label: 'Taught yourself a skill without formal training?' },
          { id: 'selfStarted', label: 'Started a project that nobody asked you to start?' },
          {
            id: 'fixedEarly',
            label: 'Identified a problem and fixed it before someone noticed?',
          },
          { id: 'ownedMistake', label: 'Taken responsibility for a mistake publicly?' },
        ],
      },
    ],
  },
  {
    id: 'growth',
    title: 'Commitment to Growth',
    intro: 'These measure intent, not your résumé.',
    fields: [
      {
        id: 'growthLikert',
        label: 'Growth commitments',
        type: 'likertGroup',
        required: true,
        items: [
          {
            id: 'ownMistakes',
            label: 'I will take responsibility for my mistakes and learn from them.',
          },
          {
            id: 'seekFeedback',
            label: 'I will seek feedback even when it is uncomfortable.',
          },
          {
            id: 'learnOutside',
            label: 'I will continue learning outside required training.',
          },
          {
            id: 'improveProcesses',
            label: 'I will look for ways to improve processes around me.',
          },
          { id: 'helpTeammates', label: 'I will help teammates succeed when possible.' },
        ],
      },
    ],
  },
  {
    id: 'initiative',
    title: 'Commitment to Initiative',
    fields: [
      {
        id: 'initiativeLikert',
        label: 'Initiative commitments',
        type: 'likertGroup',
        required: true,
        items: [
          {
            id: 'identifyProblems',
            label: 'I will identify problems rather than waiting for instructions.',
          },
          {
            id: 'proposeSolutions',
            label: 'I will propose solutions when I see inefficiencies.',
          },
          {
            id: 'takeOwnership',
            label: 'I will take ownership of challenges within my abilities.',
          },
          {
            id: 'askQuestions',
            label: 'I will ask questions when I do not understand something.',
          },
        ],
      },
    ],
  },
  {
    id: 'persistence',
    title: 'Commitment to Persistence',
    intro: 'Rate each statement (1 = not yet, 10 = fully committed).',
    fields: [
      {
        id: 'persistenceRatings',
        label: 'Persistence commitments',
        type: 'ratingGroup',
        required: true,
        max: 10,
        scaleHint: '1 = not yet · 10 = fully committed',
        items: [
          {
            id: 'slowProgress',
            label: 'I will continue working toward goals when progress is slow.',
          },
          {
            id: 'dependable',
            label: 'I will remain dependable during difficult periods.',
          },
          {
            id: 'longTerm',
            label: 'I will focus on long-term growth rather than short-term comfort.',
          },
          {
            id: 'repetitiveTasks',
            label:
              'I will complete important tasks even when they are repetitive or difficult.',
          },
        ],
      },
    ],
  },
  {
    id: 'problemSolving',
    title: 'Problem Solving',
    fields: [
      {
        id: 'problemStyle',
        label: 'Choose the statement closest to you',
        type: 'choice',
        required: true,
        options: [
          'I prefer clear instructions.',
          'I prefer some direction and flexibility.',
          'I enjoy figuring things out independently.',
          'I actively seek complex problems.',
        ],
      },
    ],
  },
  {
    id: 'future',
    title: 'Future Orientation',
    fields: [
      {
        id: 'futurePriorities',
        label: 'Pick your top three',
        type: 'multiselect',
        required: true,
        maxSelections: 3,
        hint: 'Choose exactly three.',
        options: [
          'Leadership',
          'Technical expertise',
          'Entrepreneurship',
          'Financial independence',
          'Helping others',
          'Innovation',
          'Stability',
          'Creativity',
          'Public impact',
          'Learning',
        ],
      },
      {
        id: 'fiveYearVision',
        label: 'What do you hope to be doing 5 years from now?',
        type: 'textarea',
        required: true,
        rows: 6,
      },
    ],
  },
  {
    id: 'inspiration',
    title: 'Inspiration',
    intro: 'These often reveal more than a résumé.',
    fields: [
      {
        id: 'currentChallenge',
        label:
          'Tell us about a challenge you have overcome. What did you learn from it, what did you learn about yourself, and how do you think it helps your mindset with future challenges you will come across?',
        type: 'textarea',
        required: true,
        rows: 6,
      },
      {
        id: 'proudInOneYear',
        label: 'What accomplishment would make you proud one year from today?',
        type: 'textarea',
        required: true,
        rows: 6,
      },
      {
        id: 'unlimitedResources',
        label: 'If given unlimited resources, what problem would you try to solve?',
        type: 'textarea',
        required: true,
        rows: 6,
      },
    ],
  },
  {
    id: 'hidden',
    title: 'Hidden High Performers',
    intro: 'Signals of drive that do not always show up on a résumé.',
    fields: [
      {
        id: 'hiddenSignals',
        label: 'Do any of these apply to you?',
        type: 'yesNoGroup',
        required: true,
        items: [
          { id: 'sideBusiness', label: 'Side business' },
          { id: 'volunteer', label: 'Volunteer work' },
          { id: 'personalWebsite', label: 'Personal website' },
          { id: 'openSource', label: 'Open-source contributions' },
          { id: 'creativeProjects', label: 'Creative projects' },
          { id: 'contentCreation', label: 'Content creation' },
          { id: 'communityLeadership', label: 'Community leadership' },
          { id: 'certifications', label: 'Professional certifications' },
        ],
      },
    ],
  },
  {
    id: 'promise',
    title: 'Looking Ahead',
    intro: 'A few quick fill-in-the-blanks. Short answers are fine — this helps us understand what you are working toward.',
    fields: [
      {
        id: 'futurePromise',
        label: 'Looking ahead',
        type: 'sentenceGroup',
        required: true,
        items: [
          {
            id: 'becoming',
            prefix: 'A year from now, I would like to be someone who',
            placeholder: 'e.g. follows through on what I start',
          },
          {
            id: 'skill',
            prefix: 'A skill I am excited to build next is',
            placeholder: 'e.g. clear written communication',
          },
          {
            id: 'challenge',
            prefix: 'I am open to challenges like',
            placeholder: 'e.g. learning tools I have never used before',
          },
          {
            id: 'opportunity',
            prefix: 'When I get involved in something I care about, I tend to',
            placeholder: 'e.g. show up consistently and ask for feedback early',
          },
        ],
      },
      {
        id: 'signature',
        label: 'Your name (confirms this submission is yours)',
        type: 'text',
        required: true,
      },
    ],
  },
]
/** Flat lookup of every field, used for validation and email rendering. */
export function allFields() {
  return APPLICATION_STEPS.flatMap(step => step.fields)
}
