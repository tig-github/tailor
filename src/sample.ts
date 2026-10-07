import type { ResumeFile } from './schema'
export const sample: ResumeFile = {
  app: 'resume-tailor',
  version: 1,
  master: {
    profile: {
      name: 'Alex Example',
      email: 'alex@example.invalid',
      phone: '(000) 000-0000',
      location: 'Sample City, CA',
      links: [
        { id: 'ln1', label: 'LinkedIn', url: 'linkedin.invalid/in/sample-profile' },
        { id: 'ln2', label: 'Portfolio', url: 'example.org/portfolio' },
      ],
    },
    sections: [
      {
        id: 's1',
        type: 'summary',
        title: 'Summary',
        items: [
          {
            id: 'i1',
            heading: '',
            bullets: [
              {
                id: 'b1',
                text: 'Software engineer with 7 years building React, TypeScript, and Node.js applications. Leads accessible product work, improves performance, and turns customer needs into measurable results.',
                tags: ['frontend', 'leadership'],
              },
            ],
          },
        ],
      },
      {
        id: 's2',
        type: 'experience',
        title: 'Experience',
        items: [
          {
            id: 'i2',
            heading: 'Sample Company A',
            subheading: 'Senior Software Engineer',
            location: 'Sample City, CA',
            dateStart: '2022-03',
            dateEnd: 'Present',
            bullets: [
              {
                id: 'b2',
                text: 'Led five engineers to rebuild a React analytics dashboard, improving task completion 32% for 18,000 monthly users.',
                tags: ['frontend', 'leadership'],
              },
              {
                id: 'b3',
                text: 'Built Node.js event APIs processing 2M events daily; retry handling and monitoring sustained 99.95% uptime.',
                tags: ['backend'],
              },
              {
                id: 'b10',
                text: 'Cut dashboard load time from 4.2 to 1.6 seconds through code splitting, query caching, and image optimization.',
                tags: ['frontend', 'performance'],
              },
              {
                id: 'b11',
                text: 'Built an accessible component library for six products, adding keyboard support and automated accessibility checks.',
                tags: ['frontend', 'accessibility'],
              },
            ],
          },
          {
            id: 'i3',
            heading: 'Sample Company B',
            subheading: 'Software Engineer',
            location: 'Sample City, CA',
            dateStart: '2019-06',
            dateEnd: '2022-02',
            bullets: [
              {
                id: 'b5',
                text: 'Created reusable React components and UI guidance, reducing feature delivery time 25% across desktop and mobile.',
                tags: ['frontend'],
              },
              {
                id: 'b6',
                text: 'Shipped guided onboarding with product and design; funnel experiments raised new-account activation 18%.',
                tags: ['frontend'],
              },
              {
                id: 'b13',
                text: 'Added integration tests and GitHub Actions release checks, cutting production regressions 30% and supporting weekly releases.',
                tags: ['backend', 'testing'],
              },
            ],
          },
        ],
      },
      {
        id: 's3',
        type: 'projects',
        title: 'Projects',
        items: [
          {
            id: 'i4',
            heading: 'Open Source Accessibility Toolkit',
            subheading: 'Maintainer',
            dateStart: '2021-01',
            dateEnd: 'Present',
            bullets: [
              {
                id: 'b7',
                text: 'Built an accessibility audit tool used by 1,200 developers to find labeling, contrast, and keyboard navigation issues.',
                tags: ['frontend'],
              },
            ],
          },
        ],
      },
      {
        id: 's5',
        type: 'skills',
        title: 'Skills',
        items: [
          {
            id: 'i6',
            heading: 'Languages',
            bullets: [
              {
                id: 'b8',
                text: 'TypeScript, JavaScript, Python, SQL, HTML, CSS',
                tags: ['frontend', 'backend'],
              },
            ],
          },
          {
            id: 'i7',
            heading: 'Frameworks & Tools',
            bullets: [
              {
                id: 'b9',
                text: 'React, Node.js, PostgreSQL, AWS, Docker, Git, GitHub Actions',
                tags: ['backend'],
              },
            ],
          },
          {
            id: 'i8',
            heading: 'Core Skills',
            bullets: [
              {
                id: 'b15',
                text: 'REST APIs, automated testing, accessibility, performance optimization, Agile delivery',
                tags: ['frontend', 'backend'],
              },
            ],
          },
        ],
      },
      {
        id: 's4',
        type: 'education',
        title: 'Education',
        items: [
          {
            id: 'i5',
            heading: 'Example State University',
            subheading: 'Bachelor of Science in Computer Science',
            location: 'Sample City, CA',
            dateEnd: '2019-05',
            bullets: [],
          },
        ],
      },
    ],
  },
  variants: [
    { id: 'v1', name: 'Default', excluded: [] },
    { id: 'v2', name: 'Frontend focus', excluded: ['b3', 'b13'] },
  ],
  activeVariantId: 'v1',
}
