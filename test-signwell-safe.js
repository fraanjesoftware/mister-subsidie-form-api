const axios = require('axios');

const API_URL = 'https://mister-subsidie-form-api-h8fvgydvheenczea.westeurope-01.azurewebsites.net/api/createSignWellSigningSession';

async function testSignWellSafe() {
  const requestData = {
    templateId: "da64f360-505b-42b4-9eed-39f179a23a79",
    signers: [
      {
        email: "test@mickeyfraanje.com",
        name: "Mickey Fraanje",
        tabs: {
          textTabs: [
            // Only use fields that won't trigger the Name_1/Name_2 issue
            { tabLabel: "bedrijfsnaam", value: "Safe Test Company B.V." },
            { tabLabel: "kvk", value: "99887766" },
            { tabLabel: "postcode", value: "5678 CD" },
            { tabLabel: "plaats", value: "Utrecht" },
            { tabLabel: "functie", value: "Manager" },
            { tabLabel: "nace", value: "62.02" },
            { tabLabel: "onderneming-adres", value: "Veilige Straat 456" },
            { tabLabel: "voorletters-tekenbevoegde", value: "S.T." },
            { tabLabel: "achternaam-tekenbevoegde", value: "Tester" },
            { tabLabel: "fte", value: "75" },
            { tabLabel: "jaaromzet", value: "€ 10.000.000" },
            { tabLabel: "balanstotaal", value: "€ 5.000.000" },
            { tabLabel: "boekjaar", value: "2023" },
            { tabLabel: "minimis-2.1", value: "n.v.t." },
            { tabLabel: "minimis-3.1", value: "n.v.t." },
            { tabLabel: "minimis-3.2", value: "n.v.t." },
          ],
            radioGroupTabs: [
              {
                groupName: "de-minimis",
                radios: [
                  { value: "geen", selected: false },
                  { value: "wel", selected: true },
                  { value: "andere", selected: false }
                ]
              },
              {
                groupName: "company-size",
                radios: [
                  { value: "kleine", selected: false },
                  { value: "middel", selected: false },
                  { value: "grote", selected: true }
                ]
              }
            ]
          
        }
      }
    ],
      // Use checkbox_groups to enforce radio button behavior (exactly one selection)
      checkbox_groups: [
        {
          group_name: "de-minimis-group",
          recipient_id: "recipient_1",
          checkbox_ids: ["geen", "wel", "andere"],
          validation: "exact",
          exact_value: 1,
          required: true
        },
        {
          group_name: "company-size-group",
          recipient_id: "recipient_1",
          checkbox_ids: ["kleine", "middel", "grote"],
          validation: "exact",
          exact_value: 1,
          required: true
        }
      ],




            // Don't include 'naam' to avoid Name_1/Name_2 mapping issue
     
    
    embeddedSigning: false,
    embeddedSigningNotifications: true,
    draft: false,
    testMode: true
  };

  try {
    console.log('Testing SignWell with safe fields (avoiding naam field)...\n');
    
    const response = await axios.post(API_URL, requestData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('\nSuccess! Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.signingUrl) {
      console.log('\nSigning URL:', response.data.signingUrl);
      console.log('\nDocument should have the following populated:');
      console.log('- All text fields except naam');
      console.log('- Duplicate fields: bedrijfsnaam_2, bedrijfsnaam_3, kvk_2, functie_2, plaats_2');
      console.log('- Checkboxes: geen=true, wel=false, andere=false, grote=true, kleine=false, middel=false');
      console.log('- Conditional fields should have spaces');
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testSignWellSafe();